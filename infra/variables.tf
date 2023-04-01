variable "prefix" {
  default = "ivokun"
}

variable "project" {
  default = "Internal"
}

variable "contact" {
  default = "salahuddin.mi@gmail.com"
}

variable "dns_zone_name" {
  description = "Domain Name"
  default     = "ivokun.com"
}

variable "api_ecr_version" {
  description = "Latest API ECR Image"
  default     = "202304010647"
}

variable "cloudflare_email" {
  description = "Cloudflare Email"
  # default email is a dummy email
  default = "nero@go.com"
}

variable "cloudflare_token" {
  description = "Cloudflare Token"
  # default token is a dummy token 
  default = "1234567890abcdef1234567890abcdef12345678"
}

variable "ivokun_zone_id" {
  description = "Cloudflare Zone ID"
  # default zone id is a dummy zone id
  default = "1234567890abcdef1234567890abcdef"
}
