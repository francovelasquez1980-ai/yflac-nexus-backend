import express from 'express';
import cors from 'cors';
import scdl from 'soundcloud-downloader';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const soundcloudDescargar = scdl.default;

app.post('/descargar', async (req, res) => {
    let { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del recurso.' });
    }

    if (url.includes('?')) {
        url = url.split('?')[0];
    }

    console.log(`[NEXUS SOUNDCLOUD] Extrayendo flujo nativo para: ${url}`);

    try {
        const info = await soundcloudDescargar.getInfo(url);
        const tituloLimpio = (info.title || `track_${Date.now()}`).replace(/[/\\?%*:|"<>\s]/g, '_');

        console.log(`[NEXUS SOUNDCLOUD] Transmitiendo: ${tituloLimpio}`);

        // Forzamos la descarga en formato nativo (.mp3) para asegurar compatibilidad total
        // Esto hace que el reproductor de Windows pueda medir el tiempo y dejarte adelantar la canción
        res.setHeader('Content-Disposition', `attachment; filename="nexus_${tituloLimpio}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        // Descargamos el flujo directo de alta calidad
        const streamAudio = await soundcloudDescargar.download(url);

        streamAudio.pipe(res);

        streamAudio.on('end', () => {
            console.log(`[NEXUS] ¡Archivo enviado correctamente!`);
        });

        streamAudio.on('error', (streamErr) => {
            console.error('[NEXUS STREAM ERROR]:', streamErr);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error en la transmisión.' });
            }
        });

    } catch (error) {
        console.error(`[NEXUS ERROR]:`, error);
        return res.status(500).json({ error: 'Error al conectar con SoundCloud.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus SoundCloud Nativo activo en puerto ${PORT}`);
});
