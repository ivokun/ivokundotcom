resource "cloudflare_record" "cms" {
  zone_id = var.ivokun_zone_id
  name    = "cms"
  value   = var.prod_cms_api_endpoint
  type    = "CNAME"
  proxied = "true"
}
