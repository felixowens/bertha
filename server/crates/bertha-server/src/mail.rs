//! Outgoing email: sign-in links, invitations, assignments and alerts. Plain text only; it reads
//! well everywhere and nothing tracks opens.

use std::sync::{Arc, Mutex};

use anyhow::Context;
use lettre::message::Mailbox;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::config::{Smtp, SmtpSecurity};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Mail {
    pub to: String,
    pub subject: String,
    pub body: String,
}

#[derive(Clone)]
pub enum Mailer {
    Smtp {
        transport: Box<AsyncSmtpTransport<Tokio1Executor>>,
        from: Mailbox,
    },
    /// No SMTP configured: write messages to the log, so links still work locally.
    Log,
    /// Tests read what was sent.
    Memory(Arc<Mutex<Vec<Mail>>>),
}

impl Mailer {
    pub fn from_config(smtp: Option<&Smtp>) -> anyhow::Result<Mailer> {
        let Some(s) = smtp else { return Ok(Mailer::Log) };
        let builder = match s.security {
            SmtpSecurity::Tls => AsyncSmtpTransport::<Tokio1Executor>::relay(&s.host)?,
            SmtpSecurity::StartTls => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&s.host)?,
            SmtpSecurity::None => AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&s.host),
        };
        let mut builder = builder.port(s.port).timeout(Some(std::time::Duration::from_secs(15)));
        if let (Some(u), Some(p)) = (&s.username, &s.password) {
            builder = builder.credentials(Credentials::new(u.clone(), p.clone()));
        }
        let from = s.from.parse().with_context(|| format!("SMTP_FROM is not an email address: {:?}", s.from))?;
        Ok(Mailer::Smtp { transport: Box::new(builder.build()), from })
    }

    pub fn memory() -> (Mailer, Arc<Mutex<Vec<Mail>>>) {
        let sent = Arc::new(Mutex::new(Vec::new()));
        (Mailer::Memory(sent.clone()), sent)
    }

    pub async fn send(&self, mail: Mail) -> anyhow::Result<()> {
        match self {
            Mailer::Smtp { transport, from } => {
                let msg = Message::builder()
                    .from(from.clone())
                    .to(mail.to.parse().with_context(|| format!("not an email address: {:?}", mail.to))?)
                    .subject(mail.subject)
                    .body(mail.body)?;
                transport.send(msg).await.context("SMTP delivery failed")?;
            }
            Mailer::Log => {
                tracing::info!(to = %mail.to, subject = %mail.subject, "email (SMTP not configured)\n{}", mail.body);
            }
            Mailer::Memory(sent) => {
                if let Ok(mut s) = sent.lock() {
                    s.push(mail);
                }
            }
        }
        Ok(())
    }

    /// Checks the SMTP server answers and accepts our login. For startup.
    pub async fn check(&self) -> anyhow::Result<()> {
        if let Mailer::Smtp { transport, .. } = self {
            transport.test_connection().await.context("can't connect to the SMTP server")?;
        }
        Ok(())
    }
}

pub fn sign_in(to: &str, link: &str) -> Mail {
    Mail {
        to: to.to_owned(),
        subject: "Sign in to bertha".into(),
        body: format!(
            "Open this link to sign in to bertha:\n\n{link}\n\nIt works once and expires in 15 minutes. \
             If you didn't ask to sign in, ignore this email."
        ),
    }
}

pub fn invite(to: &str, from_name: &str, projects: &[String], link: &str) -> Mail {
    let what = match projects {
        [] => "bertha".to_owned(),
        [one] => one.clone(),
        [rest @ .., last] => format!("{} and {last}", rest.join(", ")),
    };
    Mail {
        to: to.to_owned(),
        subject: format!("{from_name} invited you to {what} on bertha"),
        body: format!(
            "{from_name} invited you to see errors and uptime for {what} on bertha.\n\n{link}\n\n\
             The invitation expires in 7 days."
        ),
    }
}

pub fn assigned(to: &str, by: &str, short_id: &str, title: &str, link: &str) -> Mail {
    Mail {
        to: to.to_owned(),
        subject: format!("{by} assigned {short_id} to you"),
        body: format!("{by} assigned you an issue on bertha.\n\n{short_id}: {title}\n\n{link}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invite_lists_projects() {
        let m = invite("a@b.c", "Charles", &["Kiln".into(), "Harbour".into(), "Moss".into()], "https://x/i");
        assert_eq!(m.subject, "Charles invited you to Kiln, Harbour and Moss on bertha");
    }
}
