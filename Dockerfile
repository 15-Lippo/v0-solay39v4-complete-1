FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git build-essential python3 python3-pip wget jq unzip software-properties-common && rm -rf /var/lib/apt/lists/*
RUN add-apt-repository -y ppa:ethereum/ethereum || true && apt-get update || true && apt-get install -y --no-install-recommends solc || true
RUN curl -L https://foundry.paradigm.xyz | bash && source /root/.bashrc && foundryup
RUN python3 -m pip install --upgrade pip && pip3 install slither-analyzer mythril echidna
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN chmod +x ./scripts/run_security.sh || true
ENTRYPOINT ["./scripts/run_security.sh"]
