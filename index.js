import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/descargar', async (req, res) => {
    let { url, formato } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Falta la URL del recurso.' });
    }

    // Limpieza inteligente de URLs para evitar conflictos
    if (url.includes('?')) {
        if (!url.includes('watch?v=') && !url.includes('youtu.be/')) {
            url = url.split('?')[0];
        }
    }

    const formatoAudio = formato === 'mp3' ? 'mp3' : 'flac';
    console.log(`[NEXUS HYBRID] Extrayendo enlace para: ${url} en formato ${formatoAudio}`);

    // Lista de endpoints alternativos por si uno se satura
    const apis = [
        'https://co.wuk.sh/api/json',
        'https://api.cobalt.tools/api/json'
    ];

    let exito = false;
    let dataResult = null;

    // Intentamos con el primer servidor, si falla, salta al segundo automáticamente
    for (const apiUrl of apis) {
        try {
            console.log(`[NEXUS HYBRID] Intentando conexión con nodo: ${apiUrl}`);
            const respuesta = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: url,
                    filenamePattern: 'nerd',
                    audioFormat: formatoAudio,
                    isAudioOnly: true
                })
            });

            if (respuesta.ok) {
                const data = await respuesta.json();
                if (data.status !== 'error' && data.url) {
                    dataResult = data;
                    exito = true;
                    break; // Rompemos el ciclo porque ya funcionó
                }
            }
        } catch (err) {
            console.warn(`[NEXUS WARNING] El nodo ${apiUrl} no respondió, probando el siguiente...`);
        }
    }

    if (exito && dataResult) {
        console.log(`[NEXUS HYBRID] ¡Extracción exitosa en nodo secundario! Enviando link...`);
        return res.json({ 
            success: true, 
            downloadUrl: dataResult.url, 
            title: `nexus_audio_${Date.now()}.${formatoAudio}` 
        });
    } else {
        return res.status(500).json({ 
            error: 'Los nodos de extracción libres de restricciones están saturados. Inténtalo de nuevo en unos segundos o usa otra URL.' 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Sistema Nexus Redundante activo en puerto ${PORT}`);
});
