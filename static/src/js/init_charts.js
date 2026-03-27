odoo.define('sales.chart_init', function(require) {
    'use strict';

    // Cargar Chart.js desde CDN
    function loadChartJS() {
        return new Promise(function(resolve) {
            if (window.Chart) {
                resolve();
                return;
            }
            
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
            script.onload = function() {
                console.log('✅ Chart.js cargado exitosamente');
                resolve();
            };
            script.onerror = function() {
                console.warn('⚠️ No se pudo cargar Chart.js desde CDN');
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    // Esperar a que el DOM esté completamente listo
    function waitForDOM(selector, maxAttempts) {
        maxAttempts = maxAttempts || 50;
        var attempts = 0;
        
        return new Promise(function(resolve) {
            var interval = setInterval(function() {
                var element = document.querySelector(selector);
                if (element) {
                    clearInterval(interval);
                    console.log('✅ Elemento encontrado:', selector);
                    resolve(element);
                } else if (++attempts >= maxAttempts) {
                    clearInterval(interval);
                    console.warn('⚠️ Elemento no encontrado después de intentos:', selector);
                    resolve(null);
                }
            }, 100);
        });
    }

    // Renderizar gráfico
    function renderChart(canvas) {
        if (!canvas) {
            console.warn('Canvas no disponible');
            return;
        }
        
        if (!window.Chart) {
            console.warn('Chart.js no disponible');
            setTimeout(function() { renderChart(canvas); }, 500);
            return;
        }

        // Destruir gráfico anterior
        if (window.chartInstance) {
            window.chartInstance.destroy();
        }

        var data = extractChartData();
        
        if (!data) {
            console.log('⚠️ Sin datos para renderizar');
            return;
        }

        console.log('📊 Renderizando gráfico con', data.dates.length, 'puntos');

        var ctx = canvas.getContext('2d');
        
        try {
            window.chartInstance = new window.Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.dates,
                    datasets: [
                        {
                            label: '📈 Ventas Predichas',
                            data: data.amounts,
                            borderColor: '#1f77b4',
                            backgroundColor: 'rgba(31, 119, 180, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '#1f77b4',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 6,
                            pointHoverRadius: 8
                        },
                        {
                            label: '📊 Promedio',
                            data: Array(data.amounts.length).fill(data.average),
                            borderColor: '#ff7f0e',
                            borderDash: [5, 5],
                            borderWidth: 2,
                            fill: false,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 500 },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 13, weight: 'bold' },
                                color: '#333',
                                padding: 15,
                                usePointStyle: true
                            }
                        },
                        title: {
                            display: true,
                            text: '🔮 Predicción de Ventas - ' + data.period_name,
                            font: { size: 16, weight: 'bold' },
                            padding: 20,
                            color: '#333'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Monto',
                                font: { weight: 'bold' }
                            },
                            ticks: {
                                callback: function(value) {
                                    return 'S/' + value.toFixed(0);
                                }
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Fecha',
                                font: { weight: 'bold' }
                            }
                        }
                    }
                }
            });

            console.log('✅ Gráfico renderizado exitosamente');
            updateTableRows();
        } catch (e) {
            console.error('❌ Error al renderizar gráfico:', e);
        }
    }

    // Extraer datos del árbol - versión mejorada
    function extractChartData() {
        // Intentar múltiples selectores para encontrar el árbol
        var treeRows = document.querySelectorAll('[data-model="sale.prediction.line"] tbody tr');
        
        // Si no encuentra, intentar con otro selector
        if (treeRows.length === 0) {
            treeRows = document.querySelectorAll('.o_data_row');
        }
        
        // Si aún no encuentra, buscar filas genéricas en tablas
        if (treeRows.length === 0) {
            var allTables = document.querySelectorAll('table tbody tr');
            if (allTables.length > 0) {
                // Tomar las últimas filas (probablemente del árbol)
                console.log('📊 Encontradas', allTables.length, 'filas en total');
            }
            treeRows = allTables;
        }
        
        if (treeRows.length === 0) {
            console.log('❌ No hay filas en el árbol de predicción');
            return null;
        }

        console.log('✅ Encontradas', treeRows.length, 'filas en el árbol');

        var dateFromInput = document.querySelector('input[name="date_from"]');
        var dateToInput = document.querySelector('input[name="date_to"]');
        var date_from = dateFromInput ? dateFromInput.value : '';
        var date_to = dateToInput ? dateToInput.value : '';
        
        // Si no hay fechas válidas, mostrar todos los datos sin filtrar
        var shouldFilter = date_from && date_to && date_from !== date_to;
        
        console.log('📊 Filtro de fechas:', shouldFilter ? (date_from + ' a ' + date_to) : 'Sin filtro (mostrar todo)');

        var dates = [];
        var amounts = [];
        var total = 0;

        // Iterar sobre las filas encontradas
        treeRows.forEach(function(row, index) {
            // Intentar múltiples formas de obtener las celdas
            var cells = row.querySelectorAll('td');
            
            if (cells.length >= 2) {
                var dateCell = cells[0];
                var amountCell = cells[1];
                
                if (dateCell && amountCell) {
                    var date = dateCell.textContent.trim() || 'Día ' + (index + 1);
                    var amountText = amountCell.textContent.trim();
                    
                    // Limpiar el texto del monto
                    var amount = parseFloat(amountText.replace(/[^0-9.-]/g, '')) || 0;
                    
                    // Aplicar filtro solo si hay fechas válidas
                    var includeRow = true;
                    if (shouldFilter) {
                        includeRow = (date >= date_from && date <= date_to);
                    }
                    
                    if (includeRow && !isNaN(amount) && amount >= 0) {
                        dates.push(date);
                        amounts.push(amount);
                        total += amount;
                        
                        if (index < 3) {
                            console.log('📊 Fila', index, '- Fecha:', date, 'Monto:', amount);
                        }
                    }
                }
            }
        });

        if (amounts.length === 0) {
            console.log('⚠️ No se encontraron datos válidos');
            return null;
        }

        var average = total / amounts.length;
        var period_name = shouldFilter ? formatDateRange(date_from, date_to) : 'Todas las Predicciones';

        console.log('📋 Datos extraídos:', {
            rango: shouldFilter ? (date_from + ' a ' + date_to) : 'Sin filtro',
            registros: amounts.length,
            promedio: average.toFixed(2)
        });

        console.log('📋 Datos extraídos:', {
            rango: date_from + ' a ' + date_to,
            registros: amounts.length,
            promedio: average.toFixed(2)
        });

        return {
            dates: dates,
            amounts: amounts,
            average: average,
            period_name: period_name,
            date_from: date_from,
            date_to: date_to
        };
    }

    // Formatear rango de fechas
    function formatDateRange(date_from, date_to) {
        // Convertir formato de fecha YYYY-MM-DD a formato legible
        var from_parts = date_from.split('-');
        var to_parts = date_to.split('-');
        
        var months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        var from_month = months[parseInt(from_parts[1]) - 1];
        var to_month = months[parseInt(to_parts[1]) - 1];
        var from_year = from_parts[0];
        var to_year = to_parts[0];
        
        if (from_year === to_year) {
            if (from_parts[1] === to_parts[1]) {
                // Mismo mes y año
                return from_parts[2] + ' - ' + to_parts[2] + ' ' + from_month + ' ' + from_year;
            } else {
                // Diferente mes, mismo año
                return from_parts[2] + ' ' + from_month + ' - ' + to_parts[2] + ' ' + to_month + ' ' + from_year;
            }
        } else {
            // Diferente año
            return from_parts[2] + ' ' + from_month + ' ' + from_year + ' - ' + to_parts[2] + ' ' + to_month + ' ' + to_year;
        }
    }

    // Actualizar visibilidad de filas
    function updateTableRows() {
        var dateFromInput = document.querySelector('input[name="date_from"]');
        var dateToInput = document.querySelector('input[name="date_to"]');
        var date_from = dateFromInput ? dateFromInput.value : '';
        var date_to = dateToInput ? dateToInput.value : '';
        
        // Si no hay fechas válidas, mostrar todas las filas
        var shouldFilter = date_from && date_to && date_from !== date_to;
        
        var treeRows = document.querySelectorAll('[data-model="sale.prediction.line"] tbody tr');
        var visible = 0;
        var hidden = 0;
        
        treeRows.forEach(function(row, index) {
            if (!shouldFilter) {
                // Mostrar todas las filas si no hay filtro
                row.style.display = '';
                visible++;
            } else {
                // Aplicar filtro por fechas
                var cells = row.querySelectorAll('td');
                if (cells && cells.length > 0) {
                    var cell_text = cells[0].textContent.trim();
                    
                    // Verificar si la fecha está dentro del rango
                    if (cell_text >= date_from && cell_text <= date_to) {
                        row.style.display = '';
                        visible++;
                    } else {
                        row.style.display = 'none';
                        hidden++;
                    }
                }
            }
        });
        
        console.log('📊 Filtradas filas - Visibles:', visible, 'Ocultas:', hidden, shouldFilter ? '(con filtro)' : '(sin filtro)');
    }

    // Configurar listeners para cambios
    function setupListeners() {
        var dateFromInput = document.querySelector('input[name="date_from"]');
        var dateToInput = document.querySelector('input[name="date_to"]');
        
        if (dateFromInput) {
            dateFromInput.addEventListener('change', function() {
                console.log('📊 Fecha desde cambiada a:', this.value);
                setTimeout(function() {
                    var canvas = document.getElementById('prediction_chart');
                    if (canvas) {
                        renderChart(canvas);
                    }
                }, 100);
            });
        }
        
        if (dateToInput) {
            dateToInput.addEventListener('change', function() {
                console.log('📊 Fecha hasta cambiada a:', this.value);
                setTimeout(function() {
                    var canvas = document.getElementById('prediction_chart');
                    if (canvas) {
                        renderChart(canvas);
                    }
                }, 100);
            });
        }

        // Configurar observer para detectar cambios en el árbol
        var treeContainer = document.querySelector('[data-model="sale.prediction.line"]');
        if (!treeContainer) {
            treeContainer = document.querySelector('.o_list_view');
        }
        if (!treeContainer) {
            treeContainer = document.querySelector('table');
        }
        
        if (treeContainer) {
            var observer = new MutationObserver(function(mutations) {
                var hasNewRows = false;
                
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        hasNewRows = true;
                    }
                });
                
                if (hasNewRows) {
                    var rows = document.querySelectorAll('[data-model="sale.prediction.line"] tbody tr');
                    if (rows.length === 0) {
                        rows = document.querySelectorAll('.o_data_row');
                    }
                    if (rows.length === 0) {
                        rows = document.querySelectorAll('table tbody tr');
                    }
                    
                    console.log('🔄 Cambio detectado en árbol -', rows.length, 'filas');
                    
                    setTimeout(function() {
                        var canvas = document.getElementById('prediction_chart');
                        if (canvas && window.Chart) {
                            renderChart(canvas);
                        }
                    }, 300);
                }
            });

            observer.observe(treeContainer, {
                childList: true,
                subtree: true,
                attributes: false
            });
            
            console.log('👁️ Observer configurado para cambios en el árbol');
        } else {
            console.warn('⚠️ No se encontró contenedor del árbol para observer');
        }
    }

    // Inicializar cuando todo esté listo
    var initPromise = Promise.all([
        loadChartJS(),
        waitForDOM('#prediction_chart')
    ]).then(function(results) {
        var canvas = results[1];
        
        if (canvas && window.Chart) {
            console.log('🚀 Configurando listeners e inicializando...');
            setupListeners();
            
            // Intentar renderizar si ya hay datos
            var rows = document.querySelectorAll('[data-model="sale.prediction.line"] tbody tr');
            if (rows.length > 0) {
                console.log('✅ Datos encontrados, renderizando gráfico...');
                renderChart(canvas);
            } else {
                console.log('⏳ Esperando datos del árbol...');
                
                // Fallback: polling cada segundo buscando datos
                var pollCount = 0;
                var pollInterval = setInterval(function() {
                    var rows = document.querySelectorAll('[data-model="sale.prediction.line"] tbody tr');
                    
                    if (rows.length === 0) {
                        rows = document.querySelectorAll('.o_data_row');
                    }
                    if (rows.length === 0) {
                        rows = document.querySelectorAll('table tbody tr');
                    }
                    
                    pollCount++;
                    
                    if (rows.length > 0) {
                        console.log('🎯 Datos encontrados por polling -', rows.length, 'filas');
                        clearInterval(pollInterval);
                        renderChart(canvas);
                    } else if (pollCount > 30) {
                        console.log('⏱️ Polling timeout - sin datos disponibles');
                        clearInterval(pollInterval);
                    }
                }, 500);
            }
        } else {
            console.warn('⚠️ No se pudo inicializar - Canvas o Chart.js no disponibles');
        }
    });

    // Exportar para uso externo
    return {
        renderChart: renderChart,
        setupListeners: setupListeners,
        extractChartData: extractChartData
    };
});
