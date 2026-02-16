#!/usr/bin/env python3
"""
Otimizador de Balanceamento - Versão Inicial
Algoritmo: Equalização de Cobertura
"""

import json
import sys
from typing import List, Dict

def should_block_transfer(transfer: Dict, rules: List[Dict]) -> bool:
    """
    Check if transfer violates any blocking rules.
    """
    for rule in rules:
        tipo = rule.get('tipo', '').lower()

        if tipo != 'bloquear':
            continue

        alvo = rule.get('alvo', {})
        condicao = rule.get('condicao', {})

        # Block specific product
        if 'cdprod' in alvo and transfer['cdprod'] == alvo['cdprod']:
            return True

        # Block specific filial origem
        if 'filial_origem' in condicao and transfer['filial_origem'] == condicao['filial_origem']:
            return True

        # Block specific filial destino
        if 'filial_destino' in condicao and transfer['filial_destino'] == condicao['filial_destino']:
            return True

        # Block specific route (origem -> destino)
        if ('filial_origem' in condicao and 'filial_destino' in condicao and
            transfer['filial_origem'] == condicao['filial_origem'] and
            transfer['filial_destino'] == condicao['filial_destino']):
            return True

        # Block by curva
        if 'curva' in alvo and transfer['curva'] == alvo['curva']:
            return True

        # Block by linha
        if 'linha' in alvo and transfer['linha'] == alvo['linha']:
            return True

    return False


def optimize_transfers(data: List[Dict], rules: List[Dict] = None) -> Dict:
    """
    Algoritmo de equalização de cobertura com cálculo de impacto.

    Entrada: lista de {cdprod, cdFilial, qtexcesso, qtnecessidade, cobertura, mediaf_un, ...}
    Saída: lista de transferências com métricas completas
    """

    # Criar lookup de informações originais por (cdprod, cdFilial)
    store_info = {}
    for row in data:
        key = (row['cdprod'], row['cdFilial'])
        store_info[key] = {
            'cobertura_inicial': row['cobertura'],
            'qtexcesso_inicial': row['qtexcesso'],
            'qtnecessidade_inicial': row['qtnecessidade'],
            'qtestoque': row.get('qtestoque', 0),
            'mediaf_un': row.get('mediaf_un', 0),
            'descricao': row.get('descricao', ''),
            'vlrcusto': row.get('vlrcusto', 0),
            'curva': row.get('curva', ''),
            'linha': row.get('linha', ''),
        }

    # Agrupar por produto
    products = {}
    for row in data:
        cdprod = row['cdprod']
        if cdprod not in products:
            products[cdprod] = {'donors': [], 'receivers': []}

        if row['qtexcesso'] > 0:
            products[cdprod]['donors'].append(row.copy())
        elif row['qtnecessidade'] > 0:
            products[cdprod]['receivers'].append(row.copy())

    # Gerar transferências
    transfers = []
    blocked_transfers = 0
    total_value = 0

    if rules is None:
        rules = []

    for cdprod, stores in products.items():
        donors = sorted(stores['donors'], key=lambda x: x['cobertura'], reverse=True)
        receivers = sorted(stores['receivers'], key=lambda x: x['cobertura'])

        for receiver in receivers:
            needed = receiver['qtnecessidade']
            receiver_key = (cdprod, receiver['cdFilial'])
            receiver_info = store_info[receiver_key]

            for donor in donors:
                if donor['qtexcesso'] <= 0:
                    continue

                donor_key = (cdprod, donor['cdFilial'])
                donor_info = store_info[donor_key]

                qty = min(needed, donor['qtexcesso'])

                # Calcular coberturas finais (aproximadas)
                # Cobertura = estoque / média_faturamento
                donor_estoque_final = donor_info['qtestoque'] - qty
                receiver_estoque_final = receiver_info['qtestoque'] + qty

                donor_mediaf = donor_info['mediaf_un'] if donor_info['mediaf_un'] > 0 else 1
                receiver_mediaf = receiver_info['mediaf_un'] if receiver_info['mediaf_un'] > 0 else 1

                cobertura_final_origem = donor_estoque_final / donor_mediaf if donor_mediaf > 0 else 0
                cobertura_final_destino = receiver_estoque_final / receiver_mediaf if receiver_mediaf > 0 else 0

                # Build transfer candidate
                transfer_candidate = {
                    'cdprod': cdprod,
                    'descricao': donor_info['descricao'],
                    'curva': donor_info['curva'],
                    'linha': donor_info['linha'],
                    'filial_origem': donor['cdFilial'],
                    'filial_destino': receiver['cdFilial'],
                    'qtexcesso_origem': donor_info['qtexcesso_inicial'],
                    'qtnecessidade_destino': receiver_info['qtnecessidade_inicial'],
                    'qt_transferida': qty,
                    'vlrcusto': donor_info['vlrcusto'],
                    'valor_gerado': round(qty * donor_info['vlrcusto'], 2),
                    'cobertura_inicial_origem': round(donor_info['cobertura_inicial'], 2),
                    'cobertura_final_origem': round(cobertura_final_origem, 2),
                    'cobertura_inicial_destino': round(receiver_info['cobertura_inicial'], 2),
                    'cobertura_final_destino': round(cobertura_final_destino, 2),
                }

                # Check rules before adding
                if should_block_transfer(transfer_candidate, rules):
                    blocked_transfers += 1
                    continue

                transfers.append(transfer_candidate)
                total_value += qty * donor_info['vlrcusto']
                donor['qtexcesso'] -= qty
                needed -= qty

                # Atualizar estoques para próximas iterações
                donor_info['qtestoque'] -= qty
                receiver_info['qtestoque'] += qty

                if needed <= 0:
                    break

    return {
        'transfers': transfers,
        'summary': {
            'total_transfers': len(transfers),
            'total_value': round(total_value, 2),
            'products_processed': len(products),
            'blocked_transfers': blocked_transfers,
            'rules_applied': len(rules)
        }
    }

if __name__ == '__main__':
    # Read from file if path provided, otherwise from argument (backward compatibility)
    if len(sys.argv) > 1:
        input_arg = sys.argv[1]

        # Check if it's a file path
        try:
            with open(input_arg, 'r', encoding='utf-8') as f:
                input_data = json.load(f)
        except FileNotFoundError:
            # Not a file, treat as JSON string
            input_data = json.loads(input_arg)
    else:
        raise ValueError("No input provided")

    # New format: { products, rules, constraints }
    # Old format: array of products (backward compatibility)
    if isinstance(input_data, dict) and 'products' in input_data:
        products = input_data.get('products', [])
        rules = input_data.get('rules', [])
        constraints = input_data.get('constraints', {})
    else:
        # Backward compatibility
        products = input_data
        rules = []
        constraints = {}

    result = optimize_transfers(products, rules)
    print(json.dumps(result))
