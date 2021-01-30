class Network {
    constructor({ host }) {
        this.host = host;
    }

    parseManifestURL({ url, fileResolution, fileResolutionTag, hostTag }) {
        return url.replace(fileResolutionTag, fileResolution).replace(hostTag, this.host);
    }

    async fetchFile(url) {
        const response = await fetch(url);
        return response.arrayBuffer();
    }

    async getProperResolution(url) {
        const startMs = Date.now();
        const response = await fetch(url);
        await response.arrayBuffer();
        const endMs = Date.now();
        const durationMs = endMs - startMs;

        // Ao invés de calcular throughtput vamos calcular pelo tempo
        const resolutions = [
            // Maior que 3 segundos e menor que 20 segundos
            {
                start: 3001,
                end: 20000,
                resolution: 144
            },
            // entre 1 segundo e 3 segundos
            {
                start: 901,
                end: 3000,
                resolution: 360
            },
            // Menos de 1 segundo
            {
                start: 0,
                end: 900,
                resolution: 720
            }
        ];

        const item = resolutions.find((item) => item.start <= durationMs && item.end >= durationMs);

        const LOWEST_RESOLUTION = 144;

        // Caso seja maior que 30 segundos
        if (!item) return LOWEST_RESOLUTION;

        return item.resolution;
    }
}
