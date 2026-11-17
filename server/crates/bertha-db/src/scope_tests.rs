//! Rules about project scope that the type system can't hold on its own. These read the
//! crate's source, so a new read or a new bypass fails here with what to do instead.

use std::fs;
use std::path::Path;

/// Every `Scope::checked` outside `scope.rs`, by file, with why it's safe. Add to this
/// list only when there is no viewer to ask; otherwise use `viewer.scope()`,
/// `viewer.scope_of(..)` or `viewer.project_scope(..)`.
const CHECKED: &[(&str, usize, &str)] = &[
    ("reads/issues.rs", 1, "summaries: the rows' own projects, from rows a viewer already read"),
    ("reads/monitors.rs", 2, "monitors_of_project and monitor_by_id: callers check the project first"),
    ("writes/projects.rs", 1, "create_project: the owner's scope was resolved before the project existed"),
];

fn sources(dir: &Path, out: &mut Vec<(String, String)>) {
    for entry in fs::read_dir(dir).expect("read src") {
        let path = entry.expect("entry").path();
        if path.is_dir() {
            sources(&path, out);
        } else if path.extension().is_some_and(|e| e == "rs") {
            let rel = path.strip_prefix(src()).expect("under src").to_string_lossy().replace('\\', "/");
            out.push((rel, fs::read_to_string(&path).expect("read file")));
        }
    }
}

fn src() -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("src")
}

fn all_sources() -> Vec<(String, String)> {
    let mut out = Vec::new();
    sources(&src(), &mut out);
    out
}

#[test]
fn checked_scopes_are_listed() {
    let mut wrong = Vec::new();
    for (file, text) in all_sources() {
        if file == "scope.rs" || file.ends_with("tests.rs") {
            continue;
        }
        let found = text.matches("Scope::checked(").count();
        let allowed = CHECKED.iter().find(|(f, ..)| *f == file).map_or(0, |(_, n, _)| *n);
        if found != allowed {
            wrong.push(format!("{file}: {found} uses of Scope::checked, {allowed} listed"));
        }
    }
    assert!(
        wrong.is_empty(),
        "{}\n\nScope::checked skips the viewer's project check. Take the scope from the viewer \
         (viewer.scope(), scope_of, project_scope). If there truly is no viewer, list the use in \
         CHECKED in scope_tests.rs with why it's safe.",
        wrong.join("\n")
    );
}

/// The public reads that take a viewer, by name.
fn viewer_reads() -> Vec<(String, String)> {
    let mut out = Vec::new();
    for (file, text) in all_sources() {
        if !file.starts_with("reads/") || file.ends_with("tests.rs") {
            continue;
        }
        let mut rest = text.as_str();
        while let Some(at) = rest.find("pub async fn ") {
            rest = &rest[at + "pub async fn ".len()..];
            let name: String = rest.chars().take_while(|c| c.is_alphanumeric() || *c == '_').collect();
            let params = rest.split_once(')').map_or("", |(p, _)| p);
            if params.contains("&Viewer") {
                out.push((file.clone(), name));
            }
        }
    }
    out
}

#[test]
fn every_viewer_read_has_a_collaborator_case() {
    let tests = fs::read_to_string(src().join("reads/tests.rs")).expect("reads/tests.rs");
    let reads = viewer_reads();
    assert!(reads.len() > 10, "found only {} viewer reads; has the signature style changed?", reads.len());
    let missing: Vec<String> = reads
        .into_iter()
        .filter(|(_, name)| !tests.contains(&format!(".{name}(&priya")))
        .map(|(file, name)| format!("{file}: {name}"))
        .collect();
    assert!(
        missing.is_empty(),
        "These reads take a Viewer but reads/tests.rs never calls them as the collaborator \
         (`db.<read>(&priya, ..)`):\n{}\n\nAdd a case to collaborators_see_only_their_projects \
         that shows priya can't see another project through it.",
        missing.join("\n")
    );
}
