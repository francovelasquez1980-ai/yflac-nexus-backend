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
    
    const idTemporal = Date.now();
    const rutaTemporalAudio = path.join('/tmp', `audio_${idTemporal}.mp3`);

    console.log(`[NEXUS HQ] Iniciando descarga premium limpia para: ${url}`);

    try {
        const info = await soundcloudDescargar.getInfo(url);
        
        // CORRECCIÓN DE LA EXPRESIÓN REGULAR: Deja solo letras, números, guiones y espacios sanos
        const tituloSeguro = (info.title || `track_${idTemporal}`)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Quita tildes de forma segura
            .replace(/[^a-zA-Z0-9\s_.-]/g, "_") // Reemplaza cualquier carácter raro por un guion bajo
            .replace(/\s+/g, '_'); // Convierte espacios en guiones bajos para las cabeceras

        const artista = info.user?.username || 'Nexus Extractor';
        
        let urlCaratula = info.artwork_url || info.user?.avatar_url || '';
        if (urlCaratula.includes('-large.')) {
            urlCaratula = urlCaratula.replace('-large.', '-t500x500.');
        }

        console.log(`[NEXUS HQ] Bajando buffer local...`);
        const streamAudio = await soundcloudDescargar.download(url);
        const archivoEscritura = fs.createWriteStream(rutaTemporalAudio);
        
        streamAudio.pipe(archivoEscritura);

        await new Promise((resolve, reject) => {
            archivoEscritura.on('finish', resolve);
            archivoEscritura.on('error', reject);
        });

        console.log(`[NEXUS HQ] Extrayendo arte de portada de SoundCloud...`);
        let bufferCaratula = null;
        if (urlCaratula) {
            try {
                const resCaratula = await fetch(urlCaratula);
                if (resCaratula.ok) {
                    const arrayBuffer = await resCaratula.arrayBuffer();
                    bufferCaratula = Buffer.from(arrayBuffer);
                }
            } catch (imgErr) {
                console.warn('[NEXUS] Portada omitida:', imgErr.message);
            }
        }

        const tags = {
            title: info.title || 'Nexus Track',
            artist: artista,
            album: 'SoundCloud HQ Stream',
            image: bufferCaratula ? {
                mime: "image/jpeg",
                type: { id: 3, name: "front cover" },
                description: "Cover",
                imageBuffer: bufferCaratula
            } : undefined
        };

        let audioBuffer = fs.readFileSync(rutaTemporalAudio);
        let audioFinalConTags = ID3.write(tags, audioBuffer);

        console.log(`[NEXUS HQ] Transmitiendo archivo final: ${tituloSeguro}.${extension}`);

        // Cabeceras HTTP 100% limpias y seguras
        res.setHeader('Content-Disposition', `attachment; filename="${tituloSeguro}.${extension}"`);
        res.setHeader('Content-Type', esFlac ? 'audio/x-flac' : 'audio/mpeg');
        res.setHeader('Content-Length', audioFinalConTags.length);

        res.end(audioFinalConTags);

        fs.unlink(rutaTemporalAudio, () => {});

    } catch (error) {
        console.error(`[NEXUS HQ CRITICAL ERROR]:`, error);
        if (fs.existsSync(rutaTemporalAudio)) fs.unlinkSync(rutaTemporalAudio);
        return res.status(500).json({ error: 'Fallo al procesar el archivo multimedia.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Motor de Inyección de Metadatos listo y reparado.`);
});
