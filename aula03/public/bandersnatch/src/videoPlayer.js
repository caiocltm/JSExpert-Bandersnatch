class VideoMediaPlayer {
    constructor({ manifestJSON, network, videoComponent }) {
        this.network = network;
        this.manifestJSON = manifestJSON;
        this.videoComponent = videoComponent;
        this.videoElement = null;
        this.sourceBuffer = null;
        this.activeItem = {};
        this.selected = {};
        this.videoDuration = 0;
        this.selections = [];
    }

    initializeCodec() {
        this.videoElement = document.getElementById('vid');
        const mediaSourceSupported = !!window.MediaSource;

        if (!mediaSourceSupported) {
            alert('Your browser or system not support Media Source Extension');
            return;
        }

        const codecSupported = MediaSource.isTypeSupported(this.manifestJSON.codec);
        if (!codecSupported) {
            alert(`Your browser or system not support the codec: ${this.manifestJSON.codec}`);
            return;
        }

        const mediaSource = new MediaSource();
        this.videoElement.src = URL.createObjectURL(mediaSource);

        mediaSource.addEventListener('sourceopen', this.sourceOpenWrapper(mediaSource));
    }

    sourceOpenWrapper(mediaSource) {
        return async (_) => {
            this.sourceBuffer = mediaSource.addSourceBuffer(this.manifestJSON.codec);
            const selected = (this.selected = this.manifestJSON.intro);

            // Evitar rodar como "Live"
            mediaSource.duration = this.videoDuration;
            await this.fileDownload(selected.url);
            setInterval(this.waitForQuestions.bind(this), 200);
        };
    }

    waitForQuestions() {
        const currentTime = parseInt(this.videoElement.currentTime);
        const option = this.selected.at === currentTime;

        if (!option) return;

        // Evita que o modal abra 2x no mesmo segundo.
        if (!this.activeItem.url === this.selected.url) return;

        this.videoComponent.configureModal(this.selected.options);
        this.activeItem = this.selected;
    }

    async currentFileResolution() {
        const LOWEST_RESOLUTION = 144;
        const prepareUrl = {
            url: this.manifestJSON.finalizar.url,
            fileResolution: LOWEST_RESOLUTION,
            fileResolutionTag: this.manifestJSON.fileResolutionTag,
            hostTag: this.manifestJSON.hostTag
        };
        const url = this.network.parseManifestURL(prepareUrl);
        return this.network.getProperResolution(url);
    }

    async nextChunk(data) {
        const key = data.toLowerCase();
        const selected = this.manifestJSON[key];
        this.selected = {
            ...selected,
            // Ajusta o tempo que o modal vai aparecer, baseado no tempo corrente.
            at: parseInt(this.videoElement.currentTime + selected.at)
        };

        this.manageLag();

        // Deixa o restante do video rodar enquanto baixa o novo.
        this.videoElement.play();
        await this.fileDownload(selected.url);
    }

    manageLag() {
        if(!!~this.selections.indexOf(this.selected.url)) {
            this.selected.at += 5;
            return;
        }

        this.selections.push(this.selected.url);
    }

    async fileDownload(url) {
        const fileResolution = await this.currentFileResolution();

        console.debug('Current Resolution ', fileResolution);

        const prepareUrl = {
            url,
            fileResolution,
            fileResolutionTag: this.manifestJSON.fileResolutionTag,
            hostTag: this.manifestJSON.hostTag
        };

        const finalUrl = this.network.parseManifestURL(prepareUrl);
        this.setVideoPlayerDuration(finalUrl);
        const data = await this.network.fetchFile(finalUrl);
        return this.processBufferSegments(data);
    }

    setVideoPlayerDuration(finalUrl) {
        const bars = finalUrl.split('/');
        const [name, videoDuration] = bars[bars.length - 1].split('-');
        this.videoDuration += parseFloat(videoDuration);
    }

    async processBufferSegments(allSegments) {
        const sourceBuffer = this.sourceBuffer;
        sourceBuffer.appendBuffer(allSegments);

        return new Promise((resolve, reject) => {
            const updateEnd = (_) => {
                sourceBuffer.removeEventListener('updateend', updateEnd);
                sourceBuffer.timestampOffset = this.videoDuration;

                return resolve();
            };

            sourceBuffer.addEventListener('updateend', updateEnd);
            sourceBuffer.addEventListener('error', reject);
        });
    }
}
