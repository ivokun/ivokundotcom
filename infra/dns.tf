data "aws_acm_certificate" "cms" {
  domain   = "cms.${var.dns_zone_name}"
  statuses = ["ISSUED"]
}

resource "aws_apigatewayv2_domain_name" "cms" {
  domain_name     = "cms.${var.dns_zone_name}"
  domain_name_configuration {
    certificate_arn = data.aws_acm_certificate.cms.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "cloudflare_record" "cms" {
  zone_id = var.ivokun_zone_id
  name    = "cms"
  value   = aws_apigatewayv2_domain_name.cms.domain_name_configuration[0].target_domain_name
  type    = "CNAME"
  proxied = "true"
}

resource "aws_apigatewayv2_api_mapping" "cms" {
  api_id      = aws_apigatewayv2_api.lambda.id
  domain_name = aws_apigatewayv2_domain_name.cms.id
  stage       = aws_apigatewayv2_stage.default.id
}
