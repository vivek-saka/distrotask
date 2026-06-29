Place your TLS certificate files here for production deployments:
  fullchain.pem
  privkey.pem

These are git-ignored (see .gitignore) — never commit real certificates or
private keys to source control. Use Let's Encrypt (certbot) or your cloud
provider's managed certificate service to obtain them.
