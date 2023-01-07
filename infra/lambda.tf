resource "aws_ecr_repository" "api" {
  name                 = "strapi-api"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_iam_role" "lambda_exec" {
  name = "serverless_lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Sid    = ""
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      }
    ]
  })
}


resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "api" {
  image_uri     = "${aws_ecr_repository.api.repository_url}:${var.api_ecr_version}"
  memory_size   = 1024
  package_type  = "Image"
  function_name = "api"
  role          = aws_iam_role.lambda_exec.arn
  timeout       = 30

  ephemeral_storage {
    size = 512
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "api" {
  name = "/aws/lambda/${aws_lambda_function.api.function_name}"

  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["*"]
    allow_headers     = ["date", "keep-alive"]
    expose_headers    = ["keep-alive", "date"]
    max_age           = 86400
  }
}
