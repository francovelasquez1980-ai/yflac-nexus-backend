import express from 'express';
import cors from 'cors';
import scdl from 'soundcloud-downloader';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const soundcloudDescargar = scdl.default;

app.post('/descargar', async (req, res) => {
    let { url, formato } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del recurso.' });
    }

    if (url.includes('?')) {
        url = url.split('?')[0];
    }

    console.log(`[NEXUS] Petición para: ${url}`);

    try {
        // Obtener la info básica para sacar el título real de la canción
        const info = await soundcloudDescargar.getInfo(url).catch(() => ({ title: `nexus_track_${Date.now()}` }));
        const tituloLimpio = (info.title || 'audio').replace(/[/\\?%*:|"<>\s]/g, '_');
        const extension = formato === 'flac' ? 'flac' : 'mp3';

        console.log(`[NEXUS] Transmitiendo flujo nativo: ${tituloLimpio}.${extension}`);

        // Le avisamos al navegador el nombre real del archivo y que es un archivo de música
        res.setHeader('Content-Disposition', `attachment; filename="${tituloLimpio}.${extension}"`);
        res.setHeader('Content-Type', formato === 'flac' ? 'audio/x-flac' : 'audio/mpeg');

        // Descargar el flujo directo desde SoundCloud
        const streamAudio = await soundcloudDescargar.download(url);

        // Enviar los datos directamente a Netlify a medida que llegan
        streamAudio.pipe(res);

        streamAudio.on('error', (err) => {
            console.error('[STREAM ERROR]:', err);
            if (!res.headersSent) res.status(500).json({ error: 'Error en transmisión.' });
        });

    } catch (error) {
        console.error(`[SYSTEM ERROR]:`, error);
        return res.status(500).json({ error: 'Error al conectar con SoundCloud de forma directa.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus SoundCloud en línea.`);
});
