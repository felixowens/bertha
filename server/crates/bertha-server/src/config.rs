//! Configuration from the environment (`/etc/bertha/env` under systemd). Everything is
//! checked at startup, so a typo fails loudly instead of at the first sign-in.

use std::net::{IpAddr, SocketAddr};
use std::path::PathBuf;

use anyhow::{Context, bail};
use bertha_core::time::{Millis, SECOND, parse_millis};
use ipnet::IpNet;

#[derive(Debug, Clone)]
pub struct Config {
    /// Where people reach bertha, e.g. `https://bertha.example.com`. Used in links and
    /// setup snippets, and decides whether cookies are `Secure`.
    pub public_url: String,
    pub database: PathBuf,
    pub bind: SocketAddr,
    pub smtp: Option<Smtp>,
    /// Serve with the clock stopped at this instant. For comparing a seeded database
    /// against the prototype's screenshots; never in production.
    pub fixed_now: Option<Millis>,
    /// Where uptime checks run from, as shown beside each check, e.g. "Frankfurt".
    pub region: String,
    /// Events, checks and source maps are kept this many days (`BERTHA_RETENTION_DAYS`).
    pub retention_days: u32,
    /// Check every monitor this often instead of its interval
    /// (`BERTHA_CHECK_EVERY_SECONDS`). For end-to-end tests; only builds with the
    /// `fixtures` feature accept it.
    pub check_every: Option<Millis>,
    /// Proxies whose `X-Forwarded-For` is believed (`BERTHA_TRUSTED_PROXIES`), on top of
    /// localhost. Behind Traefik or Caddy in Docker, that's the Docker network.
    pub trusted_proxies: Vec<IpNet>,
    /// Following fixes on GitHub (`BERTHA_GITHUB_TOKEN`); without it, fixes are marked
    /// shipped by hand.
    pub github: Option<Github>,
    /// The project bertha reports its own errors to (`BERTHA_REPORT_TO`): its short key,
    /// id or name. Off when unset.
    pub report_to: Option<String>,
}

#[derive(Clone)]
pub struct Github {
    pub token: String,
    /// `https://api.github.com`, or a fake one (`BERTHA_GITHUB_API`, tests only).
    pub api: String,
}

impl std::fmt::Debug for Github {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Github").field("token", &"…").field("api", &self.api).finish()
    }
}

#[derive(Clone)]
pub struct Smtp {
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub from: String,
    pub security: SmtpSecurity,
}

impl std::fmt::Debug for Smtp {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Smtp")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("username", &self.username)
            .field("password", &self.password.as_ref().map(|_| "…"))
            .field("from", &self.from)
            .field("security", &self.security)
            .finish()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmtpSecurity {
    /// TLS from the first byte (usually port 465).
    Tls,
    /// Plain connection upgraded with STARTTLS (usually 587). Required, not optional.
    StartTls,
    /// No encryption. Only for a local test sink.
    None,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Config> {
        Self::from_lookup(|k| std::env::var(k).ok().filter(|v| !v.trim().is_empty()))
    }

    pub fn from_lookup(get: impl Fn(&str) -> Option<String>) -> anyhow::Result<Config> {
        let public_url = get("BERTHA_URL")
            .context("BERTHA_URL is not set. Set it to the address people use, e.g. https://bertha.example.com")?;
        let public_url = public_url.trim().trim_end_matches('/').to_owned();
        if !(public_url.starts_with("https://") || public_url.starts_with("http://")) {
            bail!("BERTHA_URL must start with https:// (or http:// for local use), got {public_url:?}");
        }
        let database = PathBuf::from(get("DATABASE_PATH").unwrap_or_else(|| "bertha.db".into()));
        let bind = get("BERTHA_BIND")
            .unwrap_or_else(|| "127.0.0.1:3000".into())
            .parse()
            .context("BERTHA_BIND must be an address and port, e.g. 127.0.0.1:3000")?;
        let fixed_now = match get("BERTHA_FIXED_NOW") {
            Some(v) => Some(parse_millis(&v).with_context(|| format!("BERTHA_FIXED_NOW is not an ISO date: {v:?}"))?),
            None => None,
        };

        let smtp = match get("SMTP_HOST") {
            None => None,
            Some(host) => {
                let security = match get("SMTP_SECURITY").as_deref().unwrap_or("starttls") {
                    "tls" => SmtpSecurity::Tls,
                    "starttls" => SmtpSecurity::StartTls,
                    "none" => SmtpSecurity::None,
                    other => bail!("SMTP_SECURITY must be tls, starttls or none, got {other:?}"),
                };
                let default_port = match security {
                    SmtpSecurity::Tls => 465,
                    SmtpSecurity::StartTls => 587,
                    SmtpSecurity::None => 25,
                };
                let port = match get("SMTP_PORT") {
                    Some(p) => p.parse().with_context(|| format!("SMTP_PORT must be a number, got {p:?}"))?,
                    None => default_port,
                };
                let from = get("SMTP_FROM").context("SMTP_FROM is not set, e.g. \"bertha <bertha@example.com>\"")?;
                let username = get("SMTP_USERNAME");
                let password = get("SMTP_PASSWORD");
                if username.is_some() != password.is_some() {
                    bail!("Set both SMTP_USERNAME and SMTP_PASSWORD, or neither");
                }
                Some(Smtp { host, port, username, password, from, security })
            }
        };
        let region = get("BERTHA_REGION").unwrap_or_else(|| "bertha".into()).trim().to_owned();
        let retention_days = match get("BERTHA_RETENTION_DAYS") {
            Some(d) => match d.trim().parse::<u32>() {
                Ok(n @ 1..=3650) => n,
                _ => bail!("BERTHA_RETENTION_DAYS must be a number of days from 1 to 3650, got {d:?}"),
            },
            None => 90,
        };
        let check_every = match get("BERTHA_CHECK_EVERY_SECONDS") {
            Some(_) if !cfg!(feature = "fixtures") => {
                bail!("BERTHA_CHECK_EVERY_SECONDS is for tests, and this build doesn't accept it. Remove it.")
            }
            Some(s) => match s.trim().parse::<i64>() {
                Ok(n @ 1..=3600) => Some(n * SECOND),
                _ => bail!("BERTHA_CHECK_EVERY_SECONDS must be a number of seconds from 1 to 3600, got {s:?}"),
            },
            None => None,
        };
        let trusted_proxies = match get("BERTHA_TRUSTED_PROXIES") {
            Some(list) => list
                .split([',', ' '])
                .filter(|s| !s.is_empty())
                .map(|s| {
                    s.parse::<IpNet>().or_else(|_| s.parse::<IpAddr>().map(IpNet::from)).with_context(|| {
                        format!("BERTHA_TRUSTED_PROXIES must be addresses or ranges like 172.16.0.0/12, got {s:?}")
                    })
                })
                .collect::<anyhow::Result<_>>()?,
            None => Vec::new(),
        };
        let api = match get("BERTHA_GITHUB_API") {
            Some(_) if !cfg!(feature = "fixtures") => {
                bail!("BERTHA_GITHUB_API is for tests, and this build doesn't accept it. Remove it.")
            }
            Some(a) if a.starts_with("http://") || a.starts_with("https://") => {
                a.trim().trim_end_matches('/').to_owned()
            }
            Some(a) => bail!("BERTHA_GITHUB_API must start with http:// or https://, got {a:?}"),
            None => "https://api.github.com".to_owned(),
        };
        let github = get("BERTHA_GITHUB_TOKEN").map(|t| Github { token: t.trim().to_owned(), api });
        let report_to = get("BERTHA_REPORT_TO").map(|p| p.trim().to_owned());
        Ok(Config {
            public_url,
            database,
            bind,
            smtp,
            fixed_now,
            region,
            retention_days,
            check_every,
            trusted_proxies,
            github,
            report_to,
        })
    }

    /// Whether a request from `ip` may say who it's forwarding for.
    pub fn trusts_proxy(&self, ip: IpAddr) -> bool {
        ip.is_loopback() || self.trusted_proxies.iter().any(|net| net.contains(&ip))
    }

    pub fn secure_cookies(&self) -> bool {
        self.public_url.starts_with("https://")
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    fn cfg(pairs: &[(&str, &str)]) -> anyhow::Result<Config> {
        let m: HashMap<String, String> = pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        Config::from_lookup(|k| m.get(k).cloned())
    }

    #[test]
    fn defaults_and_checks() {
        assert!(cfg(&[]).is_err());
        assert!(cfg(&[("BERTHA_URL", "bertha.example.com")]).is_err());
        let c = cfg(&[("BERTHA_URL", "https://bertha.example.com/")]).unwrap();
        assert_eq!(c.public_url, "https://bertha.example.com");
        assert!(c.secure_cookies());
        assert!(c.smtp.is_none());
        let c = cfg(&[("BERTHA_URL", "http://localhost:3000"), ("SMTP_HOST", "smtp.x"), ("SMTP_FROM", "b@x")]).unwrap();
        let smtp = c.smtp.unwrap();
        assert_eq!((smtp.port, smtp.security), (587, SmtpSecurity::StartTls));
        assert!(
            cfg(&[("BERTHA_URL", "http://l"), ("SMTP_HOST", "s"), ("SMTP_FROM", "b@x"), ("SMTP_USERNAME", "u")])
                .is_err()
        );
        assert!(cfg(&[("BERTHA_URL", "http://l"), ("BERTHA_FIXED_NOW", "yesterday")]).is_err());
        assert_eq!(cfg(&[("BERTHA_URL", "http://l")]).unwrap().retention_days, 90);
        assert_eq!(cfg(&[("BERTHA_URL", "http://l"), ("BERTHA_RETENTION_DAYS", "30")]).unwrap().retention_days, 30);
        assert!(cfg(&[("BERTHA_URL", "http://l"), ("BERTHA_RETENTION_DAYS", "0")]).is_err());
        assert!(cfg(&[("BERTHA_URL", "http://l"), ("BERTHA_RETENTION_DAYS", "a month")]).is_err());

        let c = cfg(&[("BERTHA_URL", "http://l"), ("BERTHA_TRUSTED_PROXIES", "172.16.0.0/12, 10.0.0.7")]).unwrap();
        assert!(c.trusts_proxy("172.18.0.2".parse().unwrap()));
        assert!(c.trusts_proxy("10.0.0.7".parse().unwrap()));
        assert!(c.trusts_proxy("127.0.0.1".parse().unwrap()));
        assert!(!c.trusts_proxy("203.0.113.9".parse().unwrap()));
        assert!(!cfg(&[("BERTHA_URL", "http://l")]).unwrap().trusts_proxy("172.18.0.2".parse().unwrap()));
        assert!(cfg(&[("BERTHA_URL", "http://l"), ("BERTHA_TRUSTED_PROXIES", "docker")]).is_err());

        let fast = cfg(&[("BERTHA_URL", "http://l"), ("BERTHA_CHECK_EVERY_SECONDS", "2")]);
        if cfg!(feature = "fixtures") {
            assert_eq!(fast.unwrap().check_every, Some(2 * SECOND));
            assert!(cfg(&[("BERTHA_URL", "http://l"), ("BERTHA_CHECK_EVERY_SECONDS", "0")]).is_err());
        } else {
            assert!(fast.is_err(), "a release build refuses the test knob");
        }

        assert!(cfg(&[("BERTHA_URL", "http://l")]).unwrap().report_to.is_none());
        let c = cfg(&[("BERTHA_URL", "http://l"), ("BERTHA_REPORT_TO", " BRTA ")]).unwrap();
        assert_eq!(c.report_to.as_deref(), Some("BRTA"));

        assert!(cfg(&[("BERTHA_URL", "http://l")]).unwrap().github.is_none());
        let gh = cfg(&[("BERTHA_URL", "http://l"), ("BERTHA_GITHUB_TOKEN", " github_pat_x ")]).unwrap().github.unwrap();
        assert_eq!((gh.token.as_str(), gh.api.as_str()), ("github_pat_x", "https://api.github.com"));
        assert!(!format!("{gh:?}").contains("github_pat_x"), "the token stays out of logs");
        let fake = cfg(&[
            ("BERTHA_URL", "http://l"),
            ("BERTHA_GITHUB_TOKEN", "t"),
            ("BERTHA_GITHUB_API", "http://127.0.0.1:9/"),
        ]);
        if cfg!(feature = "fixtures") {
            assert_eq!(fake.unwrap().github.unwrap().api, "http://127.0.0.1:9");
        } else {
            let e = fake.unwrap_err().to_string();
            assert!(e.contains("BERTHA_GITHUB_API is for tests"), "{e}");
        }
    }
}
