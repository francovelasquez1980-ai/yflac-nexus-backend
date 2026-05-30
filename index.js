import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/descargar', async (req, res) => {
    let { url, formato } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del recurso.' });
    }

    console.log(`[NEXUS DIRECTO] Petición recibida para URL: ${url}`);

    try {
        // Forzamos la obtención de información saltándonos restricciones básicas
        const info = await ytdl.getInfo(url, {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        });

        const tituloLimpio = info.videoDetails.title.replace(/[/\\?%*:|"<>\s]/g, '_');
        const formatoAudio = formato === 'mp3' ? 'mp3' : 'flac';

        console.log(`[NEXUS DIRECTO] Extrayendo audio stream de: ${tituloLimpio}`);

        // Configuramos la respuesta como un archivo binario de descarga directa para tu Netlify
        res.setHeader('Content-Disposition', `attachment; filename="nexus_${tituloLimpio}.${formatoAudio}"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        // Obtenemos el flujo de audio puro directamente de los servidores de contenido
        const audioStream = ytdl(url, {
            quality: 'highestaudio',
            filter: 'audioonly',
            highWaterMark: 1 << 25 // Buffer de 32MB para evitar cortes en Render
        });

        // Conectamos el flujo de YouTube directo al navegador del usuario pasando por Render
        audioStream.pipe(res);

        audioStream.on('error', (err) => {
            console.error('[STREAM ERROR]:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error en la transmisión del flujo de audio.' });
            }
        });

    } catch (error) {
        console.error(`[NEXUS DIRECT ERROR]:`, error);
        return res.status(500).json({ 
            error: 'YouTube está rechazando la conexión directa desde el servidor.', 
            detalles: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus de Flujo Directo activo en puerto ${PORT}`);
});
