# SSL Setup

### Static IP or Hostname

* Get the Caddy instances External IP or Hostname
* Command: `kubectl get svc caddy-gateway`
* Example Output:
```sh
NAME            TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)                                        AGE
caddy-gateway   LoadBalancer   10.110.5.168   localhost     8080:30171/TCP,8443:31550/TCP,2019:31163/TCP   8h
```

### Add to DNS

* If EXTERNAL-IP is a Hostname, add a cname
* If EXTERNAL-IP is an IP Address, add a arecord

> If you have an IP: Check your Cloud Provider's console and look for a "Reserve IP" or "Make Static" button. This is safer than relying on an ephemeral IP.

