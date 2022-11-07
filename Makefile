build:
	docker build . -t devlikeapro/whatsapp-http-api

run:
	docker run --rm -d -v `pwd`/.sessions:/app/.sessions -p 127.0.0.1:3000:3000/tcp --name whatsapp-http-api devlikeapro/whatsapp-http-api

stop:
	docker stop whatsapp-http-api

push:
	docker push devlikeapro/whatsapp-http-api
