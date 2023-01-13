terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.15.1"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 3.0.0"
    }
  }
}

provider "aws" {
  region  = "ap-southeast-1"
  profile = "ivokun"
}

provider "aws" {
  alias   = "global_provider"
  region  = "us-east-1"
  profile = "ivokun"
}

provider "cloudflare" {
  api_token = var.cloudflare_token
}

locals {
  prefix = "${var.prefix}-${terraform.workspace}"
  common_tags = {
    Environment = terraform.workspace
    Project     = var.project
    Contact     = var.contact
    ManagedBy   = "Terraform"
    TFVersion   = "1.3.6"
  }
}

data "aws_region" "current" {

}
