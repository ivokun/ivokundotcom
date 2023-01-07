output "api-ecr-uri" {
  value = aws_ecr_repository.api.repository_url
}

output "api-endpoint-uri" {
  value = aws_lambda_function_url.api.function_url
}

output "endpoint-uri" {
  value = aws_apigatewayv2_stage.default.invoke_url
}
