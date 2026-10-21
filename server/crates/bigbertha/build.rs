// Records the compiler's version, which reports carry as their runtime ("Rust 1.99.0").

use std::process::Command;

fn main() {
    let rustc = std::env::var("RUSTC").unwrap_or_else(|_| "rustc".to_owned());
    let version = Command::new(rustc)
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.split_whitespace().nth(1).map(str::to_owned))
        .unwrap_or_default();
    println!("cargo:rustc-env=BIGBERTHA_RUSTC={version}");
    println!("cargo:rerun-if-env-changed=RUSTC");
}
