//! bertha's own errors, reported to one of its projects (`BERTHA_REPORT_TO`): the
//! server's through `bigbertha`, the app's through `@bigbertha/sdk` with the key that
//! `spa` puts in the page, and readable through the app's source maps, which ship in
//! the binary and are stored for that project at startup.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};

use bertha_core::ids::ProjectId;
use bertha_db::{Db, ProjectKeys};

use crate::spa::Dist;

/// Where bertha's own reports go.
#[derive(Debug, Clone)]
pub struct Reporting {
    pub project: ProjectId,
    pub ingest_key: String,
}

/// The project named by its id, short key or name, ignoring case.
pub fn find(projects: Vec<ProjectKeys>, wanted: &str) -> Option<ProjectKeys> {
    let lower = wanted.to_lowercase();
    projects.into_iter().find(|p| p.id == wanted || p.key.to_lowercase() == lower || p.name.to_lowercase() == lower)
}

/// Starts reporting the server's panics and `tracing` errors. Reports go to this
/// process over loopback, so they don't depend on the proxy in front of it.
pub fn start(to: &Reporting, bind: SocketAddr) -> Option<bigbertha::Guard> {
    let own = to.project.to_string();
    bigbertha::init(
        bigbertha::options!()
            .key(to.ingest_key.clone())
            .url(format!("http://{}", loopback(bind)))
            .before_send(move |event| (!feeds_itself(&event, &own)).then_some(event)),
    )
}

/// Whether an event is about bertha failing to take its own reports. Sending it would
/// fail the same way and report again, so it stays in this log only. Those come from
/// the batch worker, tagged with the project, or from an ingest request this process
/// sent itself: straight over loopback, so with no proxy's forwarding headers.
fn feeds_itself(event: &bigbertha::IngestEvent, own: &str) -> bool {
    if event.tags.as_ref().and_then(|t| t.get("project")).is_some_and(|p| p == own) {
        return true;
    }
    let Some(req) = &event.request else { return false };
    let headers = req.headers.clone().unwrap_or_default();
    let from_bigbertha = headers.get("user-agent").is_some_and(|ua| ua.starts_with("bigbertha/"));
    let proxied = ["x-forwarded-for", "x-real-ip", "forwarded"].iter().any(|h| headers.contains_key(*h));
    req.url.contains("/ingest/") && from_bigbertha && !proxied
}

fn loopback(bind: SocketAddr) -> SocketAddr {
    let ip = match bind.ip() {
        IpAddr::V4(ip) if ip.is_unspecified() => IpAddr::V4(Ipv4Addr::LOCALHOST),
        IpAddr::V6(ip) if ip.is_unspecified() => IpAddr::V6(Ipv6Addr::LOCALHOST),
        ip => ip,
    };
    SocketAddr::new(ip, bind.port())
}

/// The app's source maps in the binary, by path (`assets/….js.map`).
pub fn embedded_maps() -> impl Iterator<Item = String> {
    Dist::iter().filter(|p| p.ends_with(".js.map")).map(|p| p.into_owned())
}

/// Stores the app's embedded source maps for the project, so its stacks read as
/// `src/…`. Each start stores them again, which also keeps them past retention.
pub async fn store_maps(db: &Db, project: &ProjectId) -> anyhow::Result<usize> {
    let release = env!("CARGO_PKG_VERSION");
    let mut stored = 0;
    for path in embedded_maps() {
        let Some(file) = Dist::get(&path) else { continue };
        let Some(debug_id) = debug_id(&file.data) else { continue };
        let bundle = path.trim_end_matches(".map");
        db.save_sourcemap(project, &debug_id, bundle, Some(release), &file.data).await?;
        stored += 1;
    }
    Ok(stored)
}

fn debug_id(map: &[u8]) -> Option<String> {
    #[derive(serde::Deserialize)]
    struct Map {
        #[serde(rename = "debugId")]
        debug_id: Option<String>,
    }
    serde_json::from_slice::<Map>(map).ok()?.debug_id.map(|id| id.to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn keys(id: &str, key: &str, name: &str) -> ProjectKeys {
        ProjectKeys {
            id: id.into(),
            key: key.into(),
            name: name.into(),
            ingest_key: format!("ik-{key}"),
            upload_key: String::new(),
        }
    }

    #[test]
    fn finds_by_id_key_or_name() {
        let all = || vec![keys("p_1", "KILN", "Kiln and clay"), keys("p_2", "BRTA", "bertha")];
        assert_eq!(find(all(), "p_2").map(|p| p.id), Some("p_2".into()));
        assert_eq!(find(all(), "brta").map(|p| p.id), Some("p_2".into()));
        assert_eq!(find(all(), "Kiln And Clay").map(|p| p.id), Some("p_1".into()));
        assert!(find(all(), "lantern").is_none());
    }

    #[test]
    fn drops_reports_about_its_own_reports() {
        let own = "p_self";
        let tagged = |project: &str| bigbertha::IngestEvent {
            tags: Some([("project".to_owned(), project.to_owned())].into()),
            ..Default::default()
        };
        assert!(feeds_itself(&tagged(own), own));
        assert!(!feeds_itself(&tagged("p_kiln"), own));

        let request = |url: &str, headers: &[(&str, &str)]| bigbertha::IngestEvent {
            request: Some(bigbertha::IngestRequest {
                method: "POST".into(),
                url: url.into(),
                status: None,
                headers: Some(headers.iter().map(|(k, v)| ((*k).to_owned(), (*v).to_owned())).collect()),
            }),
            ..Default::default()
        };
        let ua = ("user-agent", "bigbertha/0.10.1");
        assert!(feeds_itself(&request("http://127.0.0.1:3000/ingest/v1/events", &[ua]), own));
        // Another app's report, through the proxy, is reported.
        let proxied = [ua, ("x-forwarded-for", "203.0.113.4")];
        assert!(!feeds_itself(&request("http://bertha.test/ingest/v1/events", &proxied), own));
        assert!(!feeds_itself(&request("http://127.0.0.1:3000/ingest/v1/events", &[("user-agent", "curl/8")]), own));
        assert!(!feeds_itself(&request("http://127.0.0.1:3000/api/pages/issues", &[ua]), own));
        assert!(!feeds_itself(&bigbertha::IngestEvent::default(), own));
    }

    #[test]
    fn reports_over_loopback() {
        assert_eq!(loopback("0.0.0.0:3000".parse().unwrap()), "127.0.0.1:3000".parse().unwrap());
        assert_eq!(loopback("[::]:3000".parse().unwrap()), "[::1]:3000".parse().unwrap());
        assert_eq!(loopback("10.0.0.2:8080".parse().unwrap()), "10.0.0.2:8080".parse().unwrap());
    }

    #[test]
    fn reads_the_debug_id() {
        assert_eq!(debug_id(br#"{"version":3,"debugId":"ABC-1"}"#).as_deref(), Some("abc-1"));
        assert_eq!(debug_id(br#"{"version":3}"#), None);
        assert_eq!(debug_id(b"not json"), None);
    }
}
