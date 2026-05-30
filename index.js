import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import ytDlp from 'yt-dlp-exec';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const __dirname = path.resolve();

app.post('/descargar', async (req, res) => {
    let { url, formato } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del recurso.' });
    }

    if (url.includes('?')) {
        url = url.split('?')[0];
    }

    const carpetaDescargas = path.join(__dirname, 'downloads');
    if (!fs.existsSync(carpetaDescargas)) {
        fs.mkdirSync(carpetaDescargas);
    }

    let formatoAudio = formato === 'mp3' ? 'mp3' : 'flac';
    
    console.log(`[NEXUS] Extracción nativa iniciada para: ${url} (${formatoAudio})`);

    // Configuramos los argumentos como un objeto nativo de Node, evitando colisiones de consola
    const opciones = {
        extractAudio: true,
        audioFormat: formatoAudio,
        embedThumbnail: true,
        output: path.join(carpetaDescargas, `nexus_audio_%(title)s.%(ext)s`),
        noCheckCertificates: true,
        preferFreeFormats: true
    };

    if (formatoAudio === 'mp3') {
        opciones.audioQuality = '0';
    }

    // Ejecución directa sin pasar por 'exec' de consola
    ytDlp(url, opciones)
        .then(() => {
            const archivos = fs.readdirSync(carpetaDescargas);
            const archivoProcesado = archivos.find(f => f.endsWith(`.${formatoAudio}`));

            if (!archivoProcesado) {
                return res.status(500).json({ error: 'Archivo procesado pero no localizado en disco.' });
            }

            const rutaArchivoCompleta = path.join(carpetaDescargas, archivoProcesado);

            res.download(rutaArchivoCompleta, archivoProcesado, (err) => {
                if (err) console.error(`[NEXUS ERROR] Error en envío:`, err);
                try {
                    fs.unlinkSync(rutaArchivoCompleta);
                } catch (ce) {
                    console.error(`[NEXUS WARNING] No se borró el temporal:`, ce);
                }
            });
        })
        .catch((error) => {
            console.error(`[NEXUS CORE ERROR]:`, error);
            return res.status(500).json({ 
                error: 'Error interno en el motor de extracción.', 
                detalles: error.message 
            });
        });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus Multi-Formato activo en puerto ${PORT}`);
});
