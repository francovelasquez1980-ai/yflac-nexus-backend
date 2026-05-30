import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS para que Netlify pueda hablar con Render
app.use(cors());
app.use(express.json());

app.post('/descargar', async (req, res) => {
    let { url, formato } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del recurso.' });
    }

    // Limpiar enlaces de rastreo (?utm_source...)
    if (url.includes('?')) {
        url = url.split('?')[0];
    }

    try {
        console.log(`[NEXUS NATIVO] Validando URL: ${url}`);
        
        // Verificar si la URL es válida para el motor
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'La URL proporcionada no es válida o no está soportada todavía.' });
        }

        console.log(`[NEXUS NATIVO] Obteniendo información del video...`);
        const info = await ytdl.getInfo(url);
        
        // Limpiar el título de caracteres raros que rompan el archivo en Windows/Linux
        const tituloLimpio = info.videoDetails.title.replace(/[/\\?%*:|"<>\s]/g, '_');
        const formatoAudio = formato === 'mp3' ? 'mp3' : 'flac';

        console.log(`[NEXUS NATIVO] Extrayendo audio para: ${tituloLimpio} en formato .${formatoAudio}`);

        // Configurar las cabeceras del navegador para que inicie la descarga automática
        res.setHeader('Content-Disposition', `attachment; filename="nexus_audio_${tituloLimpio}.${formatoAudio}"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        // Descargar solo el audio en la máxima calidad disponible de forma directa
        const streamAudio = ytdl(url, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        // Enviar el flujo de audio directo al navegador del usuario (sin guardar temporales en Render)
        streamAudio.pipe(res);

        streamAudio.on('end', () => {
            console.log(`[NEXUS NATIVO] ¡Descarga completada con éxito para ${tituloLimpio}!`);
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
            error: 'Error interno en el motor de extracción nativo.', 
            detalles: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus Inmune a la Nube activo en puerto ${PORT}`);
});
