#!/bin/bash
AWS_CONFIG_FILE=~/.aws/config aws sso login --profile "${AWS_PROFILE:-group-point-dev}"
