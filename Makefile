build:
	docker build . -t devlikeapro/waha

build-chrome:
	docker build . -t devlikeapro/waha-plus:chrome --build-arg USE_BROWSER=chrome

build-noweb:
	docker build . -t devlikeapro/waha:noweb --build-arg USE_BROWSER=none --build-arg WHATSAPP_DEFAULT_ENGINE=NOWEB

build-plus-gows:
	docker build . -t devlikeapro/waha-plus:gows --build-arg USE_BROWSER=none --build-arg WHATSAPP_DEFAULT_ENGINE=GOWS

build-all: build build-chrome build-noweb

build-plus:
	docker build . -t devlikeapro/waha-plus

build-ssh:
	# check IMAGE provided
	@[ "${IMAGE}" ]  || ( echo "Add APP: make build-ssh image=devlikeapro/waha"; exit 1 );
	eval $(ssh-agent) && \
	ssh-add ~/.ssh/id_rsa && \
	docker buildx build --ssh default=${SSH_AUTH_SOCK} . -t ${IMAGE} --build-arg USE_BROWSER=none

stop:
	docker stop waha

clean: stop
	sudo rm -rf .sessions

push:
	docker push devlikeapro/waha

for-swagger:
	WHATSAPP_SWAGGER_CONFIG_ADVANCED=true . ${NVM_DIR}/nvm.sh && nvm exec yarn start

up-noweb:
	. ${NVM_DIR}/nvm.sh && nvm exec yarn up @adiwajshing/baileys@github:devlikeapro/Baileys#fork-master-channels-678

up-noweb-libsignal:
	. ${NVM_DIR}/nvm.sh && nvm exec yarn up libsignal@github:devlikeapro/libsignal-node#fork-master

up-webjs:
	. ${NVM_DIR}/nvm.sh && nvm exec yarn up whatsapp-web.js@github:devlikeapro/whatsapp-web.js#fork-main-channels

start-proxy:
	docker run --rm -d --name squid-container -e TZ=UTC -p 3128:3128 ubuntu/squid:5.2-22.04_beta

proto-gows:
	rm -rf src/core/engines/gows/grpc
	mkdir -p src/core/engines/gows/grpc
	protoc \
	--plugin=protoc-gen-ts=node_modules/.bin/protoc-gen-ts \
	--plugin=protoc-gen-grpc=node_modules/.bin/grpc_tools_node_protoc_plugin \
	--js_out=import_style=commonjs,binary:src/core/engines/gows/grpc \
	--grpc_out=grpc_js:src/core/engines/gows/grpc \
	--ts_out=grpc_js:src/core/engines/gows/grpc \
	-I ../gows/proto ../gows/proto/gows.proto

gows:
	cd ../gows && \
	export PATH=${HOME}/go/bin:${PATH} && \
	make all

copy-dashboard:
	cd ../waha-hub/ui && \
	make copy-waha

