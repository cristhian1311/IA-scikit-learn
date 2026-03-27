odoo.define('sales.chart_renderer', function(require) {
    'use strict';

    var AbstractFormRenderer = require('web.AbstractFormRenderer');
    var core = require('web.core');

    // Script para cargar Chart.js
    function loadChartJS() {
        return new Promise(function(resolve) {
            if (window.Chart) {
                resolve();
                return;
            }
            
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
            script.onload = resolve;
            script.onerror = function() {
                console.error('Error loading Chart.js');
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    // Extender FormRenderer
    AbstractFormRenderer.include({
        _renderView: function() {
            var result = this._super();
            var self = this;
            
            // Esperar a que el DOM esté listo
            setTimeout(function() {
                if (self.$('#prediction_chart').length > 0) {
                    loadChartJS().then(function() {
                        self._initChart();
                        self._setupPeriodFilter();
                    });
                }
            }, 100);
            
            return result;
        },

        _initChart: function() {
            var self = this;
            var canvas = document.getElementById('prediction_chart');
            
            if (!canvas || !window.Chart) {
                return;
            }

            if (this.chart_instance) {
                this.chart_instance.destroy();
            }

            var chartData = this._getChartData();
            var ctx = canvas.getContext('2d');

            this.chart_instance = new window.Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.dates,
                    datasets: [
                        {
                            label: '📈 Ventas Predichas',
                            data: chartData.amounts,
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
                            data: Array(chartData.amounts.length).fill(chartData.average),
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
                    maintainAspectRatio: true,
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
                            text: '🔮 Predicción de Ventas - ' + chartData.period_name,
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
                                text: 'Monto (USD)',
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

            // Actualizar tabla de detalles
            this._updateTableRows();
        },

        _getChartData: function() {
            var data = this.state.data;
            var date_from = data.date_from;
            var date_to = data.date_to;
            var lines = data.prediction_line_ids.data || [];
            
            // Determinar si aplicar filtro
            var shouldFilter = date_from && date_to && date_from !== date_to;
            
            var dates = [];
            var amounts = [];
            var total = 0;

            // Filtrar líneas dentro del rango de fechas
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i][2]; // Acceder a diccionario
                if (line && line.date) {
                    var line_date = line.date;
                    
                    // Aplicar filtro solo si hay fechas válidas
                    var includeLine = true;
                    if (shouldFilter) {
                        includeLine = (line_date >= date_from && line_date <= date_to);
                    }
                    
                    if (includeLine) {
                        dates.push(line_date);
                        var amount = parseFloat(line.predicted_amount) || 0;
                        amounts.push(amount);
                        total += amount;
                    }
                }
            }

            var avg = amounts.length > 0 ? total / amounts.length : 0;
            var period_name = shouldFilter ? this._formatDateRange(date_from, date_to) : 'Todas las Predicciones';

            return {
                dates: dates.length > 0 ? dates : ['Sin datos'],
                amounts: amounts.length > 0 ? amounts : [0],
                average: avg,
                period_name: period_name,
                date_from: date_from,
                date_to: date_to
            };
        },

        _formatDateRange: function(date_from, date_to) {
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
        },

        _updateTableRows: function() {
            var data = this.state.data;
            var date_from = data.date_from;
            var date_to = data.date_to;
            
            // Si no hay fechas válidas, mostrar todas las filas
            var shouldFilter = date_from && date_to && date_from !== date_to;
            
            // Ocultar/mostrar filas del árbol según el rango de fechas
            var treeRows = document.querySelectorAll('[data-model="sale.prediction.line"] tbody tr');
            treeRows.forEach(function(row, index) {
                if (!shouldFilter) {
                    // Mostrar todas las filas si no hay filtro
                    row.style.display = '';
                } else {
                    // Aplicar filtro por fechas
                    var cells = row.querySelectorAll('td');
                    if (cells && cells.length > 0) {
                        var cell_text = cells[0].textContent.trim();
                        
                        // Verificar si la fecha está dentro del rango
                        if (cell_text >= date_from && cell_text <= date_to) {
                            row.style.display = '';
                        } else {
                            row.style.display = 'none';
                        }
                    }
                }
            });
        },

        _setupPeriodFilter: function() {
            var self = this;
            
            // Escuchar cambios en los campos de fecha
            var dateFromInput = self.$('input[name="date_from"]');
            var dateToInput = self.$('input[name="date_to"]');
            
            if (dateFromInput.length) {
                dateFromInput.on('change', function() {
                    setTimeout(function() {
                        self._initChart();
                        self._updateTableRows();
                    }, 50);
                });
            }
            
            if (dateToInput.length) {
                dateToInput.on('change', function() {
                    setTimeout(function() {
                        self._initChart();
                        self._updateTableRows();
                    }, 50);
                });
            }

            // Escuchar cambios generales
            this.on_field_changed.add(function() {
                var newData = self._getChartData();
                if (self.chart_instance && newData.dates.length > 0) {
                    self._initChart();
                }
            });
        }
    });
});
