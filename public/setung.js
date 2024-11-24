const { Chart, registerables } = require('chart.js');
Chart.register(...registerables);

// Datos de ejemplo: índice de tiempo (x) y valor (y)
const precios = [
    { x: 1, y: 100 }, { x: 2, y: 101 }, { x: 3, y: 100 },
    { x: 4, y: 102 }, { x: 5, y: 100 }, { x: 6, y: 103 },
    { x: 7, y: 100 }, { x: 8, y: 100 }, { x: 9, y: 104 }
];

function detectarSoporteResistencia(datos) {
    let soportes = [];
    let resistencias = [];
    for (let i = 1; i < datos.length - 1; i++) {
        if (datos[i].y < datos[i - 1].y && datos[i].y < datos[i + 1].y) {
            soportes.push(datos[i]);
        } else if (datos[i].y > datos[i - 1].y && datos[i].y > datos[i + 1].y) {
            resistencias.push(datos[i]);
        }
    }
    return { soportes, resistencias };
}

const { soportes, resistencias } = detectarSoporteResistencia(precios);

// Configuración inicial del gráfico
const ctx = document.getElementById('myChart').getContext('2d');
const chart = new Chart(ctx, {
    type: 'line',
    data: {
        datasets: [{
            label: 'Precios',
            data: precios,
            borderColor: 'blue',
            showLine: true,
            fill: false
        }]
    },
    options: {
        scales: {
            x: {
                type: 'linear',
                position: 'bottom'
            }
        }
    }
});

// Función para añadir líneas de soporte o resistencia
function añadirLinea(chart, valor, color) {
    chart.data.datasets.push({
        label: 'Linea',
        borderColor: color,
        borderWidth: 2,
        borderDash: [5, 5],
        data: [{ x: precios[0].x, y: valor }, { x: precios[precios.length - 1].x, y: valor }],
        fill: false
    });
}

// Dibujar líneas de soporte y resistencia
soportes.forEach(punto => añadirLinea(chart, punto.y, 'green'));
resistencias.forEach(punto => añadirLinea(chart, punto.y, 'red'));

chart.update();
