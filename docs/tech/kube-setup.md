

## Add Secrets

> Ensure ENVs are properly configured before attempting to add secrets to kube context

* Database secret - `tdsk kube secret db` 
* Docker secret - `tdsk kube secret docker` 
* TDSK secret - `tdsk kube secret tdsk`
* Payments secret - `tdsk kube secret pay`
* Email secret - `tdsk kube secret email`
* CA Certs for caddy - `tdsk kube secret egress`