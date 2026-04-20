#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de diagnóstico para verificar configuración de Odoo con Docker
Ejecutar antes de generar datos históricos
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Ejecutar comando y mostrar resultado"""
    print(f"\n🔍 {description}")
    print(f"Comando: {cmd}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print("✅ Éxito")
            if result.stdout.strip():
                print(f"Resultado: {result.stdout.strip()}")
        else:
            print("❌ Error")
            if result.stderr.strip():
                print(f"Error: {result.stderr.strip()}")
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Excepción: {e}")
        return False

def main():
    print("=" * 60)
    print("🔧 DIAGNÓSTICO - Configuración Odoo con Docker")
    print("=" * 60)

    # 1. Verificar Docker Compose
    run_command("docker-compose version", "Verificando Docker Compose")

    # 2. Verificar servicios corriendo
    success = run_command("docker-compose ps", "Verificando servicios de Docker")
    if not success:
        print("\n❌ Docker Compose no está funcionando correctamente")
        return

    # 3. Verificar puerto 8201 expuesto
    success = run_command("docker-compose ps | grep 8201", "Verificando puerto 8201 expuesto")
    if not success:
        print("\n⚠️  Puerto 8201 no parece estar expuesto")
        print("Verifica que tienes 'ports: - \"8201:8069\"' en docker-compose.yml")

    # 4. Verificar conexión HTTP
    success = run_command("curl -s http://localhost:8201 | head -1", "Verificando conexión HTTP a Odoo (puerto 8201)")
    if not success:
        print("\n❌ No se puede conectar a http://localhost:8201")
        print("Posibles causas:")
        print("- Odoo no está corriendo")
        print("- Puerto 8201 no está expuesto correctamente")
        print("- Firewall bloqueando")

    # 5. Verificar archivos del generador
    success = run_command("docker-compose exec odoo ls -la /mnt/extra-addons/sales/scripts/generate_sales_simple.py", "Verificando archivos del generador")
    if not success:
        print("\n❌ Archivos del generador no encontrados")
        print("Verifica que están en /mnt/extra-addons/sales/scripts/")

    # 6. Verificar conexión a BD
    success = run_command("docker-compose exec odoo psql -h db -U odoo -d comercial -c 'SELECT 1' 2>/dev/null", "Verificando conexión a base de datos")
    if not success:
        print("\n⚠️  No se puede conectar a la base de datos")
        print("Verifica credenciales y que PostgreSQL está corriendo")

    print("\n" + "=" * 60)
    print("📋 RESUMEN DE DIAGNÓSTICO")
    print("=" * 60)
    print("Si todos los checks anteriores muestran ✅, entonces puedes proceder.")
    print("Si hay algún ❌, resuélvelo antes de ejecutar el generador.")
    print("\nPara ejecutar el generador:")
    print("Opción 1 (Recomendada): docker-compose exec -u odoo odoo bash")
    print("Opción 2 (Alternativa): python generate_sales_direct.py --host localhost --port 8201 --db comercial --password admin")

if __name__ == "__main__":
    main()