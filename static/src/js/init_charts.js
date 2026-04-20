'use strict';
// Sistema de gráficos mejorado
(function() {
    console.log('✅ init_charts.js cargado');
    
    function loadChart() {
        if (window.Chart) {
            console.log('✅ Chart.js ya está en memoria');
            return Promise.resolve();
        }
        return new Promise(function(r) {
            console.log('📥 Cargando Chart.js...');
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
            s.onload = function() {
                console.log('✅ Chart.js cargado');
                r();
            };
            s.onerror = function() {
                console.error('❌ Error cargando Chart.js');
                r();
            };
            document.head.appendChild(s);
        });
    }
    
    function renderChart(canvas) {
        if (!canvas) return console.warn('⚠️ Canvas no encontrado');
        if (!window.Chart) return console.warn('⚠️ Chart.js no disponible');
        
        console.log('🎨 Renderizando gráfico...');
        try {
            var chart = window.Chart.getChart(canvas);
            if (chart) {
                console.log('🗑️ Destruyendo gráfico anterior...');
                chart.destroy();
            }
        } catch (e) {
            console.warn('Nota:', e.message);
        }
        
        try {
            // Buscar datos de la tabla
            var rows = document.querySelectorAll('table tbody tr, .o_data_row');
            console.log('📊 Filas encontradas:', rows.length);
            
            var dates = [], amounts = [];
            for (var i = 0; i < rows.length; i++) {
                var cells = rows[i].querySelectorAll('td');
                if (cells.length >= 2) {
                    var dateStr = cells[0].textContent.trim();
                    var amountStr = cells[1].textContent.trim();
                    var amount = parseFloat(amountStr.replace(/[^0-9.,]/g, '').replace(',', '.'));
                    
                    if (!isNaN(amount) && amount > 0) {
                        dates.push(dateStr);
                        amounts.push(amount);
                    }
                }
            }
            
            console.log('📈 Datos extraídos - Fechas:', dates.length, 'Montos:', amounts.length);
            
            if (amounts.length === 0) {
                console.warn('⚠️ No hay datos válidos para mostrar');
                return;
            }
            
            // Crear gráfico
            new window.Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Predicción de Ventas',
                        data: amounts,
                        borderColor: '#1f77b4',
                        backgroundColor: 'rgba(31, 119, 180, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#1f77b4'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true },
                        title: { 
                            display: true, 
                            text: '📈 Predicción de Ventas',
                            font: { size: 16, weight: 'bold' }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
            
            console.log('✅ Gráfico renderizado correctamente');
        } catch (e) {
            console.error('❌ Error al renderizar gráfico:', e);
        }
    }
    
    function findAndRenderChart() {
        console.log('🔍 Buscando canvas...');
        var canvas = document.querySelector('#prediction_chart');
        
        if (canvas) {
            console.log('✅ Canvas encontrado');
            renderChart(canvas);
        } else {
            console.log('⏳ Canvas no encontrado, reintentando en 500ms...');
            setTimeout(findAndRenderChart, 500);
        }
    }
    
    function init() {
        console.log('🚀 Iniciando sistema de gráficos...');
        loadChart().then(function() {
            findAndRenderChart();
        });
    }
    
    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Exponer funciones globales para uso manual
    window.salesChart = {
        init: init,
        render: function() {
            var canvas = document.querySelector('#prediction_chart');
            if (canvas) renderChart(canvas);
            else console.warn('Canvas #prediction_chart no encontrado');
        }
    };
    
    console.log('✅ Sistema de gráficos listo');
})();
            if (canvas) renderChart(canvas);
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    window.salesChart = { render: function() { renderChart(document.querySelector('#prediction_chart')); } };
})();
