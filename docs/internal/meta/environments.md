# Environments

## Local

### Caddy

> TODO: Caddy URL not currently resolving

* URL: `http://localhost:2019`
* Config: `http://0.0.0.0:2019/config/`
* Upstreams: `http://0.0.0.0:2019/reverse_proxy/upstreams`
* Test:
```sh
curl -I -X OPTIONS https://px.local.threadedstack.app -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" --insecure
```

curl -I -X OPTIONS https://px.local.threadedstack.app/health -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" --insecure

### Proxy

* URL: `http://localhost:7118`
* Health: `http://localhost:7118/health`


### Backend

* URL: `http://localhost:5885`
* Health: `http://localhost:5885/_/health`



