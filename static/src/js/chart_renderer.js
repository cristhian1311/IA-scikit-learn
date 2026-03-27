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
                                    return '$' + value.toFixed(0);
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
            this._updateTableRows(chartData.limit);
        },

        _getChartData: function() {
            var data = this.state.data;
            var period = data.period_filter || '7days';
            var lines = data.prediction_line_ids.data || [];
            
            var limit = 7;
            if (period === '1month') limit = 30;
            if (period === '3months') limit = 90;

            var dates = [];
            var amounts = [];
            var total = 0;

            for (var i = 0; i < lines.length && i < limit; i++) {
                var line = lines[i][2]; // Acceder a diccionario
                if (line && line.date) {
                    dates.push(line.date);
                    var amount = parseFloat(line.predicted_amount) || 0;
                    amounts.push(amount);
                    total += amount;
                }
            }

            var avg = amounts.length > 0 ? total / amounts.length : 0;
            var periodNames = {
                '7days': 'Últimos 7 Días',
                '1month': 'Próximo Mes',
                '3months': 'Próximos 3 Meses'
            };

            return {
                dates: dates.length > 0 ? dates : ['Sin datos'],
                amounts: amounts.length > 0 ? amounts : [0],
                average: avg,
                period_name: periodNames[period] || 'Predicción',
                limit: limit
            };
        },

        _updateTableRows: function(limit) {
            // Ocultar/mostrar filas del árbol según el límite
            var treeRows = document.querySelectorAll('[data-model="sale.prediction.line"] tbody tr');
            treeRows.forEach(function(row, index) {
                row.style.display = index < limit ? '' : 'none';
            });
        },

        _setupPeriodFilter: function() {
            var self = this;
            
            // Escuchar cambios en el select de período
            var periodSelect = self.$('select[name="period_filter"]');
            periodSelect.on('change', function() {
                setTimeout(function() {
                    self._initChart();
                }, 50);
            });

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
