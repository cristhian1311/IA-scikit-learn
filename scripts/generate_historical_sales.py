#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script para generar datos históricos de ventas en Odoo
Genera ~10,000 órdenes de POS distribuidas en 5 años con variaciones realistas

Uso desde Odoo shell:
    exec(open('/path/to/generate_historical_sales.py').read())
"""

import os
import sys
import random
from datetime import datetime, timedelta
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('SalesDataGenerator')

# Estos se llenan cuando se ejecuta en el contexto de Odoo
try:
    env  # Esto solo existirá en odoo shell
except NameError:
    print("⚠️  Este script debe ejecutarse dentro de 'odoo shell'")
    print("Uso: odoo shell -d nombre_bd -c /path/odoo.conf")
    sys.exit(1)


class SalesDataGenerator:
    """Generador de datos históricos de ventas realistas para Perú"""
    
    def __init__(self, env, years=5, orders_count=10000):
        self.env = env
        self.years = years
        self.orders_count = orders_count
        self.pos_order_model = env['pos.order']
        self.pos_session_model = env['pos.session']
        self.partner_model = env['res.partner']
        self.journal_model = env['account.journal']
        
    def get_pos_session(self):
        """Obtener o crear una sesión POS"""
        sessions = self.pos_session_model.search([], limit=1, order='id desc')
        if sessions:
            return sessions[0]
        # Si no hay sesión, crear una genérica
        logger.warning("No hay sesión POS. Algunos campos pueden quedar vacíos.")
        return None
    
    def get_pos_journal(self):
        """Obtener journal de POS"""
        journals = self.journal_model.search([('type', '=', 'cash')], limit=1)
        return journals[0] if journals else None
    
    def get_random_partner(self):
        """Obtener cliente aleatorio"""
        partners = self.partner_model.search([('is_company', '=', False)], limit=50)
        if partners:
            return random.choice(partners)
        return None
    
    def get_seasonal_multiplier(self, month):
        """
        Retorna multiplicador de ventas según mes (datos reales de Perú)
        Basado en festividades y temporadas mencionadas en el código
        """
        multipliers = {
            1: 1.3,   # Año Nuevo, verano, playas
            2: 1.1,   # Carnavales, playa
            3: 0.9,   # Fin de verano, Semana Santa
            4: 0.85,  # Otoño, clima templado
            5: 1.2,   # Día de la Madre
            6: 1.15,  # Día del Padre, Inti Raymi
            7: 1.4,   # Fiestas Patrias (28-29)
            8: 0.8,   # Invierno, frío
            9: 0.9,   # Primavera
            10: 1.25, # Señor de los Milagros (Oct morado)
            11: 1.3,  # Pre-navidad, Black Friday
            12: 1.5   # Navidad, Año Nuevo
        }
        return multipliers.get(month, 1.0)
    
    def get_daily_sales_pattern(self, day_of_week):
        """Patrón de ventas por día de semana"""
        patterns = {
            0: 0.7,   # Lunes
            1: 0.8,   # Martes
            2: 0.85,  # Miércoles
            3: 0.9,   # Jueves
            4: 1.2,   # Viernes (mayor venta)
            5: 1.4,   # Sábado (mayor venta)
            6: 1.1    # Domingo
        }
        return patterns.get(day_of_week, 1.0)
    
    def generate_random_amount(self, base_amount=100):
        """Generar monto aleatorio con variación"""
        # Simular diferentes tipos de compras
        sale_type = random.choices(
            ['small', 'medium', 'large', 'xlarge'],
            weights=[0.5, 0.25, 0.15, 0.1]
        )[0]
        
        if sale_type == 'small':
            amount = random.uniform(5, 50)
        elif sale_type == 'medium':
            amount = random.uniform(50, 150)
        elif sale_type == 'large':
            amount = random.uniform(150, 500)
        else:  # xlarge
            amount = random.uniform(500, 2000)
        
        # Agregar variación aleatoria
        amount *= random.uniform(0.9, 1.1)
        return round(amount, 2)
    
    def generate_sales_data(self):
        """Generar datos de ventas históricos"""
        logger.info("🚀 Iniciando generación de datos históricos...")
        logger.info(f"   Período: {self.years} años")
        logger.info(f"   Órdenes objetivo: {self.orders_count:,}")
        
        # Calcular fechas
        today = datetime.now().date()
        start_date = today - timedelta(days=365 * self.years)
        
        # Obtener sesión y journal
        pos_session = self.get_pos_session()
        pos_journal = self.get_pos_journal()
        
        orders_to_create = []
        current_date = start_date
        orders_created = 0
        
        # Distribuir órdenes a lo largo del período
        days_in_period = (today - start_date).days
        orders_per_day_avg = self.orders_count / days_in_period
        
        logger.info(f"   Órdenes por día (promedio): {orders_per_day_avg:.1f}")
        
        while current_date <= today and orders_created < self.orders_count:
            # Calcular número de órdenes para este día
            # Agregar variación para simular días con más/menos ventas
            day_multiplier = random.gauss(1.0, 0.3)  # Distribución normal
            day_multiplier = max(0.1, min(3.0, day_multiplier))  # Limitar entre 0.1 y 3.0
            
            orders_today_count = int(orders_per_day_avg * day_multiplier)
            
            # Aplicar patrones de día de semana y estacionales
            day_of_week = current_date.weekday()
            month = current_date.month
            
            daily_pattern = self.get_daily_sales_pattern(day_of_week)
            seasonal_multiplier = self.get_seasonal_multiplier(month)
            
            orders_today_count = max(1, int(orders_today_count * daily_pattern * seasonal_multiplier))
            
            # Generar órdenes para este día
            for i in range(orders_today_count):
                if orders_created >= self.orders_count:
                    break
                
                # Hora aleatoria durante el día (8am a 8pm)
                hour = random.randint(8, 20)
                minute = random.randint(0, 59)
                second = random.randint(0, 59)
                
                order_datetime = datetime.combine(current_date, 
                    datetime.min.time().replace(hour=hour, minute=minute, second=second))
                
                # Generar monto
                amount = self.generate_random_amount()
                
                # Partner aleatorio (cliente)
                partner = self.get_random_partner()
                
                order_data = {
                    'name': f'POS-{current_date.strftime("%Y%m%d")}-{i:04d}',
                    'date_order': order_datetime,
                    'amount_total': amount,
                    'amount_tax': amount * 0.18,  # IGV 18%
                    'amount_paid': amount,
                    'state': random.choice(['paid', 'done']),  # Estados finalizados
                    'partner_id': partner.id if partner else None,
                }
                
                if pos_session:
                    order_data['session_id'] = pos_session.id
                if pos_journal:
                    order_data['journal_id'] = pos_journal.id
                
                orders_to_create.append(order_data)
                orders_created += 1
            
            current_date += timedelta(days=1)
            
            # Log de progreso cada 100 días
            if (current_date - start_date).days % 100 == 0:
                progress = ((current_date - start_date).days / days_in_period) * 100
                logger.info(f"   Progreso: {progress:.1f}% ({orders_created:,} órdenes)")
        
        logger.info(f"✅ Datos preparados: {len(orders_to_create):,} órdenes")
        return orders_to_create
    
    def insert_sales_data(self, orders_data):
        """Insertar datos en la base de datos"""
        logger.info("📊 Insertando datos en pos.order...")
        
        batch_size = 100
        inserted = 0
        
        try:
            for i in range(0, len(orders_data), batch_size):
                batch = orders_data[i:i+batch_size]
                
                # Crear órdenes
                for order_data in batch:
                    try:
                        order = self.pos_order_model.create(order_data)
                        inserted += 1
                    except Exception as e:
                        logger.warning(f"Error insertando orden: {e}")
                        continue
                
                # Log de progreso
                if (i // batch_size) % 10 == 0:
                    progress = (i / len(orders_data)) * 100
                    logger.info(f"   {progress:.1f}% completado ({inserted:,} órdenes insertadas)")
            
            logger.info(f"✅ Inserción completada: {inserted:,}/{len(orders_data)} órdenes")
            return inserted
            
        except Exception as e:
            logger.error(f"❌ Error durante inserción: {e}")
            raise
    
    def generate_and_insert(self):
        """Ejecutar generación e inserción completa"""
        try:
            # Generar datos
            sales_data = self.generate_sales_data()
            
            # Insertar en BD
            inserted = self.insert_sales_data(sales_data)
            
            # Resumen
            logger.info("\n" + "="*60)
            logger.info("📈 RESUMEN DE GENERACIÓN DE DATOS")
            logger.info("="*60)
            logger.info(f"Período: {self.years} años")
            logger.info(f"Órdenes insertadas: {inserted:,}")
            logger.info(f"Modelo: pos.order")
            logger.info("="*60)
            logger.info("✨ Los datos están listos para predicciones!")
            logger.info("   Ahora puedes ejecutar: action_predict_sales()")
            
            return {
                'success': True,
                'inserted': inserted,
                'message': f'Se insertaron {inserted:,} órdenes exitosamente'
            }
            
        except Exception as e:
            logger.error(f"❌ Error en proceso: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# ============ EJECUCIÓN ============
if __name__ == '__main__' or 'env' in dir():  # Ejecutar en odoo shell
    
    print("\n" + "="*60)
    print("🤖 GENERADOR DE DATOS HISTÓRICOS DE VENTAS (ODOO)")
    print("="*60)
    
    generator = SalesDataGenerator(env, years=5, orders_count=10000)
    result = generator.generate_and_insert()
    
    print("\n" + result['message'])
