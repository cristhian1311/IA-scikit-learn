#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Generador de datos históricos - Versión simplificada
Más ligera y optimizada para inserción masiva
"""

import random
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)


def generate_historical_sales_data(env, years=5, total_orders=10000):
    """
    Genera e inserta datos históricos de ventas en pos.order
    
    Parámetros:
        env: Environment de Odoo
        years: Años de histórico (default 5)
        total_orders: Número de órdenes a generar (default 10000)
    
    Retorna:
        dict con resultado de la operación
    """
    
    _logger.info("=" * 70)
    _logger.info("🚀 INICIANDO GENERACIÓN DE DATOS HISTÓRICOS")
    _logger.info("=" * 70)
    
    PosOrder = env['pos.order']
    today = datetime.now().date()
    start_date = today - timedelta(days=365 * years)
    
    # Factores estacionales para Perú (multiplicadores de ventas)
    seasonal_factors = {
        1: 1.30,   # Enero - Año Nuevo, verano en la costa
        2: 1.10,   # Febrero - Carnavales
        3: 0.90,   # Marzo - Fin de verano
        4: 0.85,   # Abril - Otoño
        5: 1.20,   # Mayo - Día de la Madre
        6: 1.15,   # Junio - Día del Padre
        7: 1.40,   # Julio - Fiestas Patrias (28-29)
        8: 0.80,   # Agosto - Invierno intenso
        9: 0.90,   # Septiembre - Primavera
        10: 1.25,  # Octubre - Señor de los Milagros
        11: 1.30,  # Noviembre - Pre-navidad, Black Friday
        12: 1.50   # Diciembre - Navidad
    }
    
    # Patrones por día de semana
    weekday_factors = {
        0: 0.7,    # Lunes
        1: 0.8,    # Martes
        2: 0.85,   # Miércoles
        3: 0.9,    # Jueves
        4: 1.2,    # Viernes
        5: 1.4,    # Sábado
        6: 1.1     # Domingo
    }
    
    # Obtener datos necesarios
    pos_sessions = env['pos.session'].search([], limit=5)
    pos_session = pos_sessions[0] if pos_sessions else None
    
    partners = env['res.partner'].search([('is_company', '=', False)], limit=100)
    
    journals = env['account.journal'].search([('type', '=', 'cash')], limit=1)
    journal = journals[0] if journals else None
    
    # Generación de órdenes
    orders_batch = []
    current_date = start_date
    days_total = (today - start_date).days
    orders_per_day_avg = total_orders / days_total
    
    _logger.info(f"📅 Período: {years} años ({days_total} días)")
    _logger.info(f"📊 Órdenes por día (promedio): {orders_per_day_avg:.2f}")
    
    order_counter = 0
    progress_checkpoint = 0
    
    while current_date <= today and order_counter < total_orders:
        
        day_of_week = current_date.weekday()
        month = current_date.month
        
        # Calcular órdenes para este día
        daily_multiplier = random.gauss(1.0, 0.3)
        daily_multiplier = max(0.1, min(3.0, daily_multiplier))
        
        orders_today = int(
            orders_per_day_avg * 
            daily_multiplier * 
            weekday_factors[day_of_week] * 
            seasonal_factors[month]
        )
        
        if orders_today == 0:
            orders_today = 1 if random.random() > 0.5 else 0
        
        # Generar órdenes del día
        for order_idx in range(orders_today):
            if order_counter >= total_orders:
                break
            
            # Construir orden
            hour = random.randint(8, 20)
            minute = random.randint(0, 59)
            order_datetime = datetime.combine(
                current_date,
                datetime.min.time().replace(hour=hour, minute=minute)
            )
            
            # Monto de venta (variado)
            sale_type = random.choices(
                ['small', 'medium', 'large'],
                weights=[0.5, 0.35, 0.15]
            )[0]
            
            if sale_type == 'small':
                amount = random.uniform(10, 80)
            elif sale_type == 'medium':
                amount = random.uniform(80, 300)
            else:
                amount = random.uniform(300, 1500)
            
            amount = round(amount * random.uniform(0.95, 1.05), 2)
            
            order_vals = {
                'date_order': order_datetime,
                'amount_total': amount,
                'amount_paid': amount,
                'amount_tax': round(amount * 0.18, 2),
                'state': 'paid',
            }
            
            # Agregar relaciones si existen
            if pos_session:
                order_vals['session_id'] = pos_session.id
            if journal:
                order_vals['journal_id'] = journal.id
            if partners:
                order_vals['partner_id'] = random.choice(partners).id
            
            orders_batch.append(order_vals)
            order_counter += 1
            
            # Insertar en lotes de 100
            if len(orders_batch) >= 100:
                try:
                    PosOrder.create(orders_batch)
                    _logger.info(f"✓ Insertadas {len(orders_batch)} órdenes (Total: {order_counter}/{total_orders})")
                except Exception as e:
                    _logger.warning(f"⚠️  Error insertando lote: {e}")
                
                orders_batch = []
        
        # Mostrar progreso
        days_processed = (current_date - start_date).days
        if days_processed - progress_checkpoint >= 100:
            pct = (days_processed / days_total) * 100
            _logger.info(f"📈 {pct:.1f}% completado ({order_counter:,} órdenes)")
            progress_checkpoint = days_processed
        
        current_date += timedelta(days=1)
    
    # Insertar último lote
    if orders_batch:
        try:
            PosOrder.create(orders_batch)
            _logger.info(f"✓ Insertadas últimas {len(orders_batch)} órdenes")
        except Exception as e:
            _logger.warning(f"⚠️  Error en último lote: {e}")
    
    _logger.info("=" * 70)
    _logger.info(f"✅ GENERACIÓN COMPLETADA: {order_counter:,} órdenes insertadas")
    _logger.info("=" * 70)
    _logger.info("💡 Próximos pasos:")
    _logger.info("   1. Verifica los datos en: Punto de Venta > Órdenes")
    _logger.info("   2. Ejecuta predicciones: Recomendador IA > Predecir Ventas")
    _logger.info("   3. Verifica gráficos en el dashboard")
    
    return {
        'success': True,
        'total_orders': order_counter,
        'period_years': years,
        'message': f'✅ {order_counter:,} órdenes generadas exitosamente'
    }


# Para ejecutar desde Python:
# result = generate_historical_sales_data(env, years=5, total_orders=10000)
