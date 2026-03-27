odoo.define('sales.prediction_charts', function(require) {
    'use strict';

    var Widget = require('web.Widget');
    var FormRenderer = require('web.FormRenderer');

    // Extender FormRenderer para agregar soporte a gráficos
    FormRenderer.include({
        _renderView: function() {
            var result = this._super.apply(this, arguments);
            var self = this;
            
            // Si la vista contiene el ID del chart, inicializarlo
            setTimeout(function() {
                if (document.getElementById('sale_prediction_chart')) {
                    self._initPredictionChart();
                }
            }, 100);
            
            return result;
        },

        _initPredictionChart: function() {
            var self = this;
            var canvas = document.getElementById('prediction_chart');
            
            if (!canvas) {
                return;
            }

            // Cargar Chart.js desde CDN
            this._loadChart().then(function() {
                self._renderPredictionChart();
                self._bindPeriodFilter();
            });
        },

        _loadChart: function() {
            return new Promise(function(resolve) {
                if (typeof Chart !== 'undefined') {
                    resolve();
                    return;
                }

                var script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
                script.onload = function() {
                    resolve();
                };
                script.onerror = function() {
                    console.error('Error loading Chart.js');
                    resolve();
                };
                document.head.appendChild(script);
            });
        },

        _renderPredictionChart: function() {
            var self = this;
            var canvas = document.getElementById('prediction_chart');
            
            if (!canvas || typeof Chart === 'undefined') {
                return;
            }

            // Destruir gráfico anterior si existe
            if (this.chart_instance) {
                this.chart_instance.destroy();
            }

            var prediction_data = this._getPredictionData();
            var ctx = canvas.getContext('2d');

            this.chart_instance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: prediction_data.dates,
                    datasets: [
                        {
                            label: 'Ventas Predichas',
                            data: prediction_data.amounts,
                            borderColor: '#1f77b4',
                            backgroundColor: 'rgba(31, 119, 180, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointBackgroundColor: '#1f77b4',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 6,
                            pointHoverRadius: 8,
                            pointHoverBackgroundColor: '#0d47a1'
                        },
                        {
                            label: 'Promedio',
                            data: Array(prediction_data.amounts.length).fill(prediction_data.average),
                            borderColor: '#ff7f0e',
                            borderDash: [5, 5],
                            borderWidth: 2,
                            fill: false,
                            pointRadius: 0,
                            pointHoverRadius: 0,
                            tension: 0.2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 13, weight: 'bold' },
                                color: '#333',
                                padding: 15,
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Predicción de Ventas - ' + prediction_data.period_name,
                            font: { size: 16, weight: 'bold' },
                            padding: 20,
                            color: '#333'
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            padding: 12,
                            cornerRadius: 6,
                            titleFont: { size: 13, weight: 'bold' },
                            bodyFont: { size: 12 },
                            callbacks: {
                                label: function(context) {
                                    var label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += '$' + context.parsed.y.toFixed(2);
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Monto (USD)',
                                font: { size: 12, weight: 'bold' },
                                color: '#666'
                            },
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toFixed(0);
                                },
                                font: { size: 11 },
                                color: '#666'
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)',
                                drawBorder: false
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Fecha',
                                font: { size: 12, weight: 'bold' },
                                color: '#666'
                            },
                            ticks: {
                                font: { size: 11 },
                                color: '#666'
                            },
                            grid: {
                                display: false,
                                drawBorder: false
                            }
                        }
                    }
                }
            });
        },

        _getPredictionData: function() {
            var form_data = this.state.data;
            var period_filter = form_data.period_filter || '7days';
            
            // Obtener datos de líneas de predicción
            var prediction_lines = form_data.prediction_line_ids || [];
            var dates = [];
            var amounts = [];
            var total = 0;

            // Limitar según el período seleccionado
            var limit = 7;
            if (period_filter === '1month') {
                limit = 30;
            } else if (period_filter === '3months') {
                limit = 90;
            }

            // Procesar líneas
            if (prediction_lines.data) {
                prediction_lines.data.forEach(function(line, index) {
                    if (index < limit) {
                        dates.push(line.date || 'Día ' + (index + 1));
                        var amount = line.predicted_amount || 0;
                        amounts.push(amount);
                        total += amount;
                    }
                });
            }

            var average = amounts.length > 0 ? total / amounts.length : 0;
            var period_names = {
                '7days': 'Últimos 7 Días',
                '1month': 'Próximo Mes',
                '3months': 'Próximos 3 Meses'
            };

            return {
                dates: dates.length > 0 ? dates : ['Sin datos'],
                amounts: amounts.length > 0 ? amounts : [0],
                average: average,
                period_name: period_names[period_filter] || 'Predicción',
                period: period_filter
            };
        },

        _bindPeriodFilter: function() {
            var self = this;
            var period_select = document.querySelector('[name="period_filter"]');
            
            if (period_select) {
                period_select.addEventListener('change', function() {
                    self._renderPredictionChart();
                });
            }
        }
    });

    return {
        name: 'Prediction Charts',
        version: '1.0'
    };
});
