import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { exec, execSync } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'public')));

// AUTO-INSTALACIÓN DE DEPENDENCIAS EN LA NUBE (Para evitar bloqueos de Render)
if (process.platform !== 'win32') {
    try {
        console.log('[NEXUS] Verificando entorno Linux...');
        // Asegurar que la carpeta .bin exista
        const binFolder = path.join(__dirname, 'node_modules', '.bin');
        if (!fs.existsSync(binFolder)) {
            fs.mkdirSync(binFolder, { recursive: true });
        }
        
        // Descargar yt-dlp de forma silenciosa si no existe
        const rutaLocalYtdlp = path.join(binFolder, 'yt-dlp');
        if (!fs.existsSync(rutaLocalYtdlp)) {
            console.log('[NEXUS] Descargando motor yt-dlp oficial...');
            execSync(`wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O "${rutaLocalYtdlp}" && chmod +x "${rutaLocalYtdlp}"`);
        }

        // Instalar mutagen en segundo plano para las carátulas
        console.log('[NEXUS] Asegurando soporte de carátulas (mutagen)...');
        execSync('pip install --user mutagen || pip3 install --user mutagen');
        console.log('[NEXUS] Entorno configurado con éxito.');
    } catch (envError) {
        console.error('[NEXUS WARNING] Error configurando dependencias de fondo:', envError.message);
    }
}

// Configurar ruta según sistema operativo
const rutaYtdlp = process.platform === 'win32' 
    ? path.join(__dirname, 'yt-dlp.exe') 
    : path.join(__dirname, 'node_modules', '.bin', 'yt-dlp');

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

    let formatoAudio = 'flac';
    let comandosAdicionales = '--audio-format flac';

    if (formato === 'mp3') {
        formatoAudio = 'mp3';
        comandosAdicionales = '--audio-format mp3 --audio-quality 0';
    }

    const plantillaSalida = path.join(carpetaDescargas, `nexus_audio_%(title)s.%(ext)s`);
    
    const comando = `"${rutaYtdlp}" -x ${comandosAdicionales} --embed-thumbnail --output "${plantillaSalida}" "${url}"`;

    console.log(`[NEXUS PLAN A - CORREGIDO] Ejecutando: ${comando}`);

    exec(comando, (error, stdout, stderr) => {
        if (error) {
            console.error(`[NEXUS ERROR]:`, error);
            return res.status(500).json({ error: 'Error interno en el motor de extracción.', detalles: error.message });
        }

        const archivos = fs.readdirSync(carpetaDescargas);
        const archivoProcesado = archivos.find(f => f.endsWith(`.${formatoAudio}`));

        if (!archivoProcesado) {
            return res.status(500).json({ error: 'El motor no logró consolidar el archivo con su carátula.' });
        }

        const rutaArchivoCompleta = path.join(carpetaDescargas, archivoProcesado);

        res.download(rutaArchivoCompleta, archivoProcesado, (err) => {
            if (err) console.error(`[NEXUS ERROR] Error al enviar:`, err);
            try {
                fs.unlinkSync(rutaArchivoCompleta);
            } catch (cleanupError) {
                console.error(`[NEXUS WARNING] No se pudo borrar el temporal:`, cleanupError);
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Nexus Multi-Formato activo en puerto ${PORT}`);
});
