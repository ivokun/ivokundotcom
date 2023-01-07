terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.15.1"
    }
  }
}

provider "aws" {
  region  = "ap-southeast-1"
  profile = "ivokun"
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
