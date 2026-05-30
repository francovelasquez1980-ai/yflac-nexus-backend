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

    // LIMPIEZA INTELIGENTE: Solo corta el '?' si NO es un link de YouTube estándar
    if (url.includes('?') && !url.includes('watch?v=') && !url.includes('youtu.be/')) {
        url = url.split('?')[0];
    }

    try {
        console.log(`[NEXUS NATIVO] Procesando URL: ${url}`);
        
        // Validador tolerante: Si contiene youtube o youtu.be, lo damos por bueno para saltar bloqueos
        const esValido = ytdl.validateURL(url) || url.includes('youtube.com') || url.includes('youtu.be');
        
        if (!esValido) {
            return res.status(400).json({ error: 'La URL proporcionada no es válida o no está soportada todavía.' });
        }

        console.log(`[NEXUS NATIVO] Extrayendo información de las API...`);
        const info = await ytdl.getInfo(url);
        
        // Reemplazar caracteres problemáticos para el nombre del archivo
        const tituloLimpio = info.videoDetails.title.replace(/[/\\?%*:|"<>\s]/g, '_');
        const formatoAudio = formato === 'mp3' ? 'mp3' : 'flac';

        console.log(`[NEXUS NATIVO] Transmitiendo: ${tituloLimpio} (.${formatoAudio})`);

        // Cabeceras de descarga directa
        res.setHeader('Content-Disposition', `attachment; filename="nexus_audio_${tituloLimpio}.${formatoAudio}"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        // Flujo de audio directo de alta calidad
        const streamAudio = ytdl(url, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        streamAudio.pipe(res);

        streamAudio.on('end', () => {
            console.log(`[NEXUS NATIVO] ¡Descarga exitosa de ${tituloLimpio}!`);
        });

        streamAudio.on('error', (streamErr) => {
            console.error('[NEXUS STREAM ERROR]:', streamErr);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error durante la transmisión del audio.' });
            }
        });

    } catch (error) {
        console.error(`[NEXUS CORE ERROR]:`, error);
        return res.status(500).json({ 
            error: 'El motor nativo falló al conectar con YouTube.', 
            detalles: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus Multi-Formato Inteligente activo en puerto ${PORT}`);
});
