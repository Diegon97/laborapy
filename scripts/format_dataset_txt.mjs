import fs from 'fs';

const data = JSON.parse(fs.readFileSync('datasets/tobi_qlora_alpaca.json', 'utf8'));

let output = "==================================================\n";
output += "DATASET DE ENTRENAMIENTO TOBI RRHH - VERSION LECTURA HUMANA\n";
output += "Total de casos: " + data.length + "\n";
output += "==================================================\n\n";

output += "--- SYSTEM PROMPT (El cerebro de Tobi - Aplica a todos los casos) ---\n";
output += data[0].system + "\n\n";
output += "==================================================\n\n";

data.forEach((item, index) => {
    output += `CASO #${index + 1}\n`;
    output += `PREGUNTA / INSTRUCCION:\n${item.instruction}\n\n`;
    if (item.input && item.input.trim() !== '') {
        output += `CONTEXTO ADICIONAL:\n${item.input}\n\n`;
    }
    output += `RESPUESTA ESPERADA DE TOBI:\n${item.output}\n`;
    output += "--------------------------------------------------\n\n";
});

fs.writeFileSync('datasets/tobi_dataset_legible.txt', output, 'utf8');
console.log("Archivo tobi_dataset_legible.txt generado con exito.");
