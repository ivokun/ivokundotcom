-- This script runs when PostgreSQL container initializes
-- Creates the test database for running tests

CREATE DATABASE ivokundotcom_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE ivokundotcom_test TO postgres;
