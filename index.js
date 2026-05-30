import express from 'express';
import cors from 'cors';
import scdl from 'soundcloud-downloader';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Instancia del descargador nativo de SoundCloud
const soundcloudDescargar = scdl.default;

app.post('/descargar', async (req, res) => {
    let { url, formato } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del recurso.' });
    }

    // Limpiar enlaces de rastreo de SoundCloud (?si=... o ?utm_source...)
    if (url.includes('?')) {
        url = url.split('?')[0];
    }

    console.log(`[NEXUS SOUNDCLOUD] Solicitud de extracción para: ${url}`);

    try {
        // 1. Obtener la información de la canción (Título)
        console.log(`[NEXUS SOUNDCLOUD] Obteniendo metadatos...`);
        const info = await soundcloudDescargar.getInfo(url);
        
        // Limpiar el título de caracteres extraños para el archivo de salida
        const tituloLimpio = (info.title || `soundcloud_track_${Date.now()}`).replace(/[/\\?%*:|"<>\s]/g, '_');
        const formatoAudio = formato === 'mp3' ? 'mp3' : 'flac';

        console.log(`[NEXUS SOUNDCLOUD] Extrayendo audio para: ${tituloLimpio}`);

        // 2. Configurar las cabeceras del archivo binario
        res.setHeader('Content-Disposition', `attachment; filename="nexus_${tituloLimpio}.${formatoAudio}"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        // 3. Descargar el flujo de audio directo desde los servidores de SoundCloud
        const streamAudio = await soundcloudDescargar.download(url);

        // 4. Conectar el flujo de SoundCloud directo a tu Netlify
        streamAudio.pipe(res);

        streamAudio.on('end', () => {
            console.log(`[NEXUS SOUNDCLOUD] ¡Descarga completada con éxito!`);
        });

        streamAudio.on('error', (streamErr) => {
            console.error('[NEXUS SOUNDCLOUD STREAM ERROR]:', streamErr);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error durante la transmisión del archivo de audio.' });
            }
        });

    } catch (error) {
        console.error(`[NEXUS SOUNDCLOUD ERROR]:`, error);
        return res.status(500).json({ 
            error: 'No se pudo conectar con SoundCloud o el enlace no es público.', 
            detalles: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus Especializado en SoundCloud activo en puerto ${PORT}`);
});
