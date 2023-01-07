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
  default     = "202301071225"
}

