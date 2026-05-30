import express from 'express';
import cors from 'cors';
import scdl from 'soundcloud-downloader';
import ID3 from 'node-id3';
import fs from 'fs';
import path from 'path';

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

    const esFlac = formato === 'flac';
    const extension = esFlac ? 'flac' : 'mp3';
    
    // Rutas temporales dentro del servidor Render
    const idTemporal = Date.now();
    const rutaTemporalAudio = path.join('/tmp', `audio_${idTemporal}.mp3`);

    console.log(`[NEXUS HQ] Iniciando extracción Premium para: ${url}`);

    try {
        // 1. Obtener metadatos y carátula original de SoundCloud
        const info = await soundcloudDescargar.getInfo(url);
        const tituloLimpio = (info.title || `track_${idTemporal}`).replace(/[/\\?%*:|"<>\s]/g, '_');
        const artista = info.user?.username || 'Nexus Extractor';
        
        // Conseguir la carátula en alta definición (cambiando 'large' por 't500x500')
        let urlCaratula = info.artwork_url || info.user?.avatar_url || '';
        if (urlCaratula.includes('-large.')) {
            urlCaratula = urlCaratula.replace('-large.', '-t500x500.');
        }

        console.log(`[NEXUS HQ] Descargando pista temporal en el servidor...`);
        
        // 2. Descargar el archivo de audio completo al disco local de Render
        const streamAudio = await soundcloudDescargar.download(url);
        const archivoEscritura = fs.createWriteStream(rutaTemporalAudio);
        
        streamAudio.pipe(archivoEscritura);

        // Esperamos a que la descarga termine por completo en el servidor
        await new Promise((resolve, reject) => {
            archivoEscritura.on('finish', resolve);
            archivoEscritura.on('error', reject);
        });

        console.log(`[NEXUS HQ] Inyectando carátula y metadatos al contenedor...`);

        // 3. Descargar la imagen de la carátula en un búfer de memoria
        let bufferCaratula = null;
        if (urlCaratula) {
            try {
                const resCaratula = await fetch(urlCaratula);
                if (resCaratula.ok) {
                    const arrayBuffer = await resCaratula.arrayBuffer();
                    bufferCaratula = Buffer.from(arrayBuffer);
                }
            } catch (imgErr) {
                console.warn('[NEXUS WARNING] No se pudo procesar la carátula, se enviará solo el audio:', imgErr.message);
            }
        }

        // 4. Preparar las etiquetas de metadatos profesionales
        const tags = {
            title: info.title || 'Nexus Track',
            artist: artista,
            album: 'SoundCloud Extraction',
            image: bufferCaratula ? {
                mime: "image/jpeg",
                type: { id: 3, name: "front cover" },
                description: "Cover",
                imageBuffer: bufferCaratula
            } : undefined
        };

        // Leer el archivo descargado para meterle las etiquetas encima
        let audioBuffer = fs.readFileSync(rutaTemporalAudio);
        let audioFinalConTags = ID3.write(tags, audioBuffer);

        console.log(`[NEXUS HQ] Enviando archivo final terminado (${extension.toUpperCase()}) a Netlify...`);

        // 5. Configurar cabeceras finales con el tamaño exacto del archivo armado
        res.setHeader('Content-Disposition', `attachment; filename="nexus_${tituloLimpio}.${extension}"`);
        res.setHeader('Content-Type', esFlac ? 'audio/x-flac' : 'audio/mpeg');
        res.setHeader('Content-Length', audioFinalConTags.length);

        // Enviar el búfer completo de un solo golpe
        res.end(audioFinalConTags);

        // Limpieza: Borramos el archivo temporal del servidor para no llenar espacio en Render
        fs.unlink(rutaTemporalAudio, () => {});

    } catch (error) {
        console.error(`[NEXUS HQ ERROR]:`, error);
        // Limpieza en caso de error
        if (fs.existsSync(rutaTemporalAudio)) fs.unlinkSync(rutaTemporalAudio);
        
        return res.status(500).json({ error: 'Fallo el ensamblaje del archivo multimedia de alta fidelidad.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Motor de Inyección de Metadatos Activo en Puerto ${PORT}`);
});
