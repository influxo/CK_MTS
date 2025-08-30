import { Op, fn, col, where, literal } from 'sequelize';
import { FormResponse, FormField, Kpi } from '../../models';
import { createLogger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('kpi-calculation-service');

/**
 * Service for calculating KPIs from form responses
 */
class KpiCalculationService {
  /**
   * Build the base where clause from meta filters (dates, entity) and KPI criteria
   */
  private buildBaseWhereClause(filters: KpiFilterOptions, kpiCriteria?: object): any {
    const whereClause: any = {};

    // Date filters
    if (filters.fromDate && filters.toDate) {
      whereClause.submittedAt = {
        [Op.between]: [filters.fromDate, filters.toDate],
      };
    } else if (filters.fromDate) {
      whereClause.submittedAt = { [Op.gte]: filters.fromDate };
    } else if (filters.toDate) {
      whereClause.submittedAt = { [Op.lte]: filters.toDate };
    }

    // Entity filters
    if (filters.entityId && filters.entityType) {
      whereClause.entityId = filters.entityId;
      whereClause.entityType = filters.entityType;
    } else if (filters.entityId) {
      whereClause.entityId = filters.entityId;
    }

    if (filters.projectId) {
      whereClause.entityId = filters.projectId;
      whereClause.entityType = 'project';
    }
    if (filters.subprojectId) {
      whereClause.entityId = filters.subprojectId;
      whereClause.entityType = 'subproject';
    }
    if (filters.activityId) {
      whereClause.entityId = filters.activityId;
      whereClause.entityType = 'activity';
    }

    // Beneficiary filters (static Beneficiary model is referenced via FormResponse.beneficiaryId)
    if (filters.beneficiaryId) {
      whereClause.beneficiaryId = filters.beneficiaryId;
    }
    if (filters.beneficiaryIds && filters.beneficiaryIds.length) {
      whereClause.beneficiaryId = { [Op.in]: filters.beneficiaryIds };
    }

    // Form template filters (FormResponse.formTemplateId)
    if (filters.formTemplateId) {
      whereClause.formTemplateId = filters.formTemplateId;
    }
    if (filters.formTemplateIds && filters.formTemplateIds.length) {
      whereClause.formTemplateId = { [Op.in]: filters.formTemplateIds };
    }

    // Service filters: constrain to FormResponses that have ServiceDeliveries for given service(s)
    // Use a subquery to avoid needing a join in COUNT/SUM style queries
    const serviceFilterLiterals: any[] = [];
    if (filters.serviceId) {
      serviceFilterLiterals.push(literal(`id IN (SELECT "formResponseId" FROM service_deliveries WHERE "serviceId" = '${this.esc(filters.serviceId)}')`));
    }
    if (filters.serviceIds && filters.serviceIds.length) {
      const list = filters.serviceIds.map(id => `'${this.esc(id)}'`).join(',');
      serviceFilterLiterals.push(literal(`id IN (SELECT "formResponseId" FROM service_deliveries WHERE "serviceId" IN (${list}))`));
    }

    const andLiterals: any[] = [];

    // KPI stored filter criteria (JSONB containment)
    if (kpiCriteria) {
      const criteriaJson = JSON.stringify(kpiCriteria);
      andLiterals.push(literal(`data @> '${criteriaJson.replace(/'/g, "''")}'::jsonb`));
    }

    // Request-level data filters
    if (filters.dataFilters && Array.isArray(filters.dataFilters)) {
      andLiterals.push(...this.buildDataFilterLiterals(filters.dataFilters));
    }

    // Apply service subquery filters if any
    if (serviceFilterLiterals.length) {
      andLiterals.push(...serviceFilterLiterals);
    }

    if (andLiterals.length) {
      (whereClause as any)[Op.and] = [
        ...(((whereClause as any)[Op.and] as any[]) || []),
        ...andLiterals,
      ];
    }

    return whereClause;
  }

  /** Escape single quotes for safe SQL string literals */
  private esc(value: string): string {
    return value.replace(/'/g, "''");
  }

  /** Build SQL literals for dataFilters */
  private buildDataFilterLiterals(conds: DataFilterCondition[]): any[] {
    const parts: any[] = [];
    for (const c of conds) {
      if (!c || !c.field || !c.op) continue;
      const f = this.esc(c.field);
      const t = c.type || 'string';
      const existsCheck = `(data ? '${f}')`;
      const isNumeric = `(data->>'${f}') ~ '^[-]?\\d+(\\.\\d+)?$'`;
      const isDate = `(data->>'${f}') ~ '^\\d{4}-\\d{2}-\\d{2}'`;

      switch (c.op) {
        case 'exists':
          parts.push(literal(`${existsCheck}`));
          break;
        case 'not_exists':
          parts.push(literal(`NOT ${existsCheck}`));
          break;
        case 'eq': {
          if (c.value === undefined) break;
          const v = Array.isArray(c.value) ? c.value[0] : c.value;
          const sv = typeof v === 'string' ? `'${this.esc(v)}'` : `'${this.esc(String(v))}'`;
          parts.push(literal(`${existsCheck} AND (data->>'${f}') = ${sv}`));
          break;
        }
        case 'ne': {
          if (c.value === undefined) break;
          const v = Array.isArray(c.value) ? c.value[0] : c.value;
          const sv = typeof v === 'string' ? `'${this.esc(v)}'` : `'${this.esc(String(v))}'`;
          parts.push(literal(`${existsCheck} AND (data->>'${f}') <> ${sv}`));
          break;
        }
        case 'in': {
          const arr = Array.isArray(c.value) ? c.value : c.value !== undefined ? [c.value] : [];
          if (!arr.length) break;
          const list = arr.map(v => `'${this.esc(String(v))}'`).join(',');
          parts.push(literal(`${existsCheck} AND (data->>'${f}') IN (${list})`));
          break;
        }
        case 'nin': {
          const arr = Array.isArray(c.value) ? c.value : c.value !== undefined ? [c.value] : [];
          if (!arr.length) break;
          const list = arr.map(v => `'${this.esc(String(v))}'`).join(',');
          parts.push(literal(`${existsCheck} AND (data->>'${f}') NOT IN (${list})`));
          break;
        }
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte': {
          if (c.value === undefined) break;
          const op = c.op === 'gt' ? '>' : c.op === 'gte' ? '>=' : c.op === 'lt' ? '<' : '<=';
          if (t === 'number') {
            parts.push(literal(`${existsCheck} AND ${isNumeric} AND (data->>'${f}')::numeric ${op} ${Number(c.value)}`));
          } else if (t === 'date') {
            // Compare as date to support YYYY-MM-DD (common in forms)
            const sv = `'${this.esc(String(c.value))}'`;
            parts.push(literal(`${existsCheck} AND ${isDate} AND (data->>'${f}')::date ${op} ${sv}::date`));
          } else {
            const sv = `'${this.esc(String(c.value))}'`;
            parts.push(literal(`${existsCheck} AND (data->>'${f}') ${op} ${sv}`));
          }
          break;
        }
        default:
          // unsupported op - skip
          break;
      }
    }
    return parts;
  }
  /**
   * Calculate KPI values based on specific criteria
   */
  async calculateKpi(kpiId: string, filters: KpiFilterOptions): Promise<KpiResult> {
    try {
      // Get the KPI definition
      const kpi = await Kpi.findByPk(kpiId, {
        include: [
          {
            model: FormField,
            as: 'field',
          },
        ],
      });

      if (!kpi) {
        logger.error(`KPI with ID ${kpiId} not found`);
        throw new Error('KPI not found');
      }
      // Build the where clause based on filters + KPI criteria
      const whereClause: any = this.buildBaseWhereClause(filters, kpi.filterCriteria || undefined);
      
      // Get the field name to calculate on
      const field = await FormField.findByPk(kpi.fieldId);
      
      if (!field || !field.name) {
        throw new Error('Field not found for KPI calculation');
      }
      
      const fieldName = field.name;

      // Perform the calculation based on the KPI type
      let result: number;
      
      switch (kpi.calculationType) {
        case 'COUNT': {
          // Count responses where the field exists and is not empty
          const count = await FormResponse.count({
            where: {
              ...whereClause,
              [Op.and]: [
                ...(((whereClause as any)[Op.and] as any[]) || []),
                literal(`(data ? '${fieldName}') AND NULLIF(data->>'${fieldName}','') IS NOT NULL`)
              ]
            }
          });
          result = count;
          break;
        }
          
        case 'SUM': {
          // Sum only numeric values for the field
          const rows = await FormResponse.findAll({
            where: {
              ...whereClause,
              [Op.and]: [
                ...(((whereClause as any)[Op.and] as any[]) || []),
                literal(`(data ? '${fieldName}') AND (data->>'${fieldName}') ~ '^[-]?\\d+(\\.\\d+)?$'`)
              ]
            },
            attributes: [
              [literal(`COALESCE(SUM((data->>'${fieldName}')::numeric),0)`) as any, 'total']
            ],
            raw: true
          }) as any[];
          result = Number(rows[0]?.total ?? 0);
          break;
        }
          
        case 'AVERAGE': {
          // Average of numeric values only
          const rows = await FormResponse.findAll({
            where: {
              ...whereClause,
              [Op.and]: [
                ...(((whereClause as any)[Op.and] as any[]) || []),
                literal(`(data ? '${fieldName}') AND (data->>'${fieldName}') ~ '^[-]?\\d+(\\.\\d+)?$'`)
              ]
            },
            attributes: [
              [literal(`COALESCE(AVG((data->>'${fieldName}')::numeric),0)`) as any, 'average']
            ],
            raw: true
          }) as any[];
          result = Number(rows[0]?.average ?? 0);
          break;
        }
          
        case 'MIN': {
          // Minimum numeric value
          const rows = await FormResponse.findAll({
            where: {
              ...whereClause,
              [Op.and]: [
                ...(((whereClause as any)[Op.and] as any[]) || []),
                literal(`(data ? '${fieldName}') AND (data->>'${fieldName}') ~ '^[-]?\\d+(\\.\\d+)?$'`)
              ]
            },
            attributes: [
              [literal(`COALESCE(MIN((data->>'${fieldName}')::numeric),0)`) as any, 'min']
            ],
            raw: true
          }) as any[];
          result = Number(rows[0]?.min ?? 0);
          break;
        }
          
        case 'MAX': {
          // Maximum numeric value
          const rows = await FormResponse.findAll({
            where: {
              ...whereClause,
              [Op.and]: [
                ...(((whereClause as any)[Op.and] as any[]) || []),
                literal(`(data ? '${fieldName}') AND (data->>'${fieldName}') ~ '^[-]?\\d+(\\.\\d+)?$'`)
              ]
            },
            attributes: [
              [literal(`COALESCE(MAX((data->>'${fieldName}')::numeric),0)`) as any, 'max']
            ],
            raw: true
          }) as any[];
          result = Number(rows[0]?.max ?? 0);
          break;
        }
          
        case 'PERCENTAGE': {
          // Percentage of responses where the field equals expectedValue (default 'true')
          const totalCount = await FormResponse.count({ where: whereClause });
          if (totalCount === 0) {
            result = 0;
          } else {
            const expectedValue = (kpi.filterCriteria as any)?.expectedValue ?? 'true';
            const matchingCount = await FormResponse.count({
              where: {
                ...whereClause,
                [Op.and]: [
                  ...(((whereClause as any)[Op.and] as any[]) || []),
                  literal(`(data ? '${fieldName}') AND (data->>'${fieldName}') = '${this.esc(String(expectedValue))}'`)
                ]
              }
            });
            result = (matchingCount / totalCount) * 100;
          }
          break;
        }
          
        case 'CUSTOM':
          // For custom calculations, we'll need to implement specific logic
          // based on the KPI definition
          logger.error(`Custom KPI calculations not yet implemented for KPI ${kpiId}`);
          throw new Error('Custom KPI calculations not yet implemented');
          
        default:
          logger.error(`Unknown calculation type: ${kpi.calculationType}`);
          throw new Error(`Unknown calculation type: ${kpi.calculationType}`);
      }
      
      // Return the KPI result with metadata
      return {
        kpiId: kpi.id,
        name: kpi.name,
        description: kpi.description,
        result,
        fieldName,
        calculationType: kpi.calculationType,
        aggregationType: kpi.aggregationType,
        timestamp: new Date()
      };
      
    } catch (error: any) {
      logger.error(`Error calculating KPI ${kpiId}: ${error.message}`);
      throw new Error(`Error calculating KPI: ${error.message}`);
    }
  }

  /**
   * Calculate KPI time series grouped by a time unit
   */
  async calculateKpiSeries(
    kpiId: string,
    filters: KpiFilterOptions & { groupBy: 'day' | 'week' | 'month' | 'quarter' | 'year' }
  ): Promise<KpiSeriesResult> {
    try {
      const kpi = await Kpi.findByPk(kpiId);
      if (!kpi) {
        logger.error(`KPI with ID ${kpiId} not found`);
        throw new Error('KPI not found');
      }

      const field = await FormField.findByPk(kpi.fieldId);
      if (!field || !field.name) {
        throw new Error('Field not found for KPI calculation');
      }
      const fieldName = field.name;

      const whereClause: any = this.buildBaseWhereClause(filters, kpi.filterCriteria || undefined);
      const unit = filters.groupBy;
      const bucketExpr = fn('date_trunc', unit, col('submittedAt'));

      let valueExpr = '';
      switch (kpi.calculationType) {
        case 'COUNT':
          valueExpr = `COUNT(*) FILTER (WHERE (data ? '${this.esc(fieldName)}') AND NULLIF(data->>'${this.esc(fieldName)}','') IS NOT NULL)`;
          break;
        case 'SUM':
          valueExpr = `COALESCE(SUM(CASE WHEN (data ? '${this.esc(fieldName)}') AND (data->>'${this.esc(fieldName)}') ~ '^[-]?\\d+(\\.\\d+)?$' THEN (data->>'${this.esc(fieldName)}')::numeric ELSE 0 END),0)`;
          break;
        case 'AVERAGE':
          valueExpr = `COALESCE(AVG(NULLIF((CASE WHEN (data ? '${this.esc(fieldName)}') AND (data->>'${this.esc(fieldName)}') ~ '^[-]?\\d+(\\.\\d+)?$' THEN (data->>'${this.esc(fieldName)}')::numeric ELSE NULL END),NULL)),0)`;
          break;
        case 'MIN':
          valueExpr = `COALESCE(MIN(CASE WHEN (data ? '${this.esc(fieldName)}') AND (data->>'${this.esc(fieldName)}') ~ '^[-]?\\d+(\\.\\d+)?$' THEN (data->>'${this.esc(fieldName)}')::numeric ELSE NULL END),0)`;
          break;
        case 'MAX':
          valueExpr = `COALESCE(MAX(CASE WHEN (data ? '${this.esc(fieldName)}') AND (data->>'${this.esc(fieldName)}') ~ '^[-]?\\d+(\\.\\d+)?$' THEN (data->>'${this.esc(fieldName)}')::numeric ELSE NULL END),0)`;
          break;
        case 'PERCENTAGE': {
          const expectedValue = (kpi.filterCriteria as any)?.expectedValue ?? 'true';
          const expected = `'${this.esc(String(expectedValue))}'`;
          valueExpr = `CASE WHEN COUNT(*) = 0 THEN 0 ELSE (SUM(CASE WHEN (data ? '${this.esc(fieldName)}') AND (data->>'${this.esc(fieldName)}') = ${expected} THEN 1 ELSE 0 END)::float / COUNT(*)::float) * 100 END`;
          break;
        }
        default:
          throw new Error(`Unknown calculation type: ${kpi.calculationType}`);
      }

      const rows = await FormResponse.findAll({
        where: whereClause,
        attributes: [
          [bucketExpr, 'periodStart'],
          [literal(valueExpr) as any, 'value']
        ],
        group: [bucketExpr],
        order: [[col('periodStart'), 'ASC']],
        raw: true
      }) as any[];

      const series = rows.map(r => ({
        periodStart: new Date(r.periodStart),
        value: Number(r.value ?? 0)
      }));

      return {
        kpiId: kpi.id,
        name: kpi.name,
        fieldName,
        calculationType: kpi.calculationType,
        granularity: unit,
        series
      };
    } catch (error: any) {
      logger.error(`Error calculating KPI series ${kpiId}: ${error.message}`);
      throw new Error(`Error calculating KPI series: ${error.message}`);
    }
  }

  /**
   * Calculate all KPIs for a specific entity
   */
  async calculateAllKpisForEntity(
    entityId: string,
    entityType: string,
    filters: KpiFilterOptions = {}
  ): Promise<KpiResult[]> {
    try {
      // Find all active KPIs
      const kpis = await Kpi.findAll({
        where: { isActive: true },
        include: [{
          model: FormField,
          as: 'field',
        }]
      });
      
      // Calculate each KPI
      const results = await Promise.all(
        kpis.map(kpi => 
          this.calculateKpi(kpi.id, { 
            ...filters, 
            entityId, 
            entityType 
          })
          .catch(err => {
            logger.error(`Error calculating KPI ${kpi.id}: ${err.message}`);
            return null;
          })
        )
      );
      
      // Filter out any failed calculations
      return results.filter(result => result !== null) as KpiResult[];
      
    } catch (error: any) {
      logger.error(`Error calculating KPIs for entity ${entityId}: ${error.message}`);
      throw new Error(`Error calculating KPIs: ${error.message}`);
    }
  }
  
  /**
   * Register new form fields from a form template schema
   */
  async registerFormFields(template: any): Promise<void> {
    try {
      if (!template.schema || !template.schema.fields || !Array.isArray(template.schema.fields)) {
        logger.warn('Invalid schema structure, cannot register form fields');
        return;
      }
      
      const fields = template.schema.fields;
      
      // Process each field in the schema
      for (const field of fields) {
        if (!field.name || !field.type) {
          logger.warn('Field missing name or type, skipping', field);
          continue;
        }
        
        // Check if this field already exists
        const existingField = await FormField.findOne({
          where: { name: field.name }
        });
        
        if (!existingField) {
          // Create a new field entry
          await FormField.create({
            id: uuidv4(),
            name: field.name,
            type: field.type,
            description: field.label || `Field ${field.name}`,
            isKpiField: field.type === 'number' || field.type === 'boolean' || field.type === 'select',
          });
          
          logger.info(`Registered new form field: ${field.name} (${field.type})`);
        }
      }
    } catch (error: any) {
      logger.error(`Error registering form fields: ${error.message}`);
      throw new Error(`Error registering form fields: ${error.message}`);
    }
  }
  
  /**
   * Get all available fields that can be used for KPIs
   */
  async getKpiFields(all: boolean = false): Promise<FormField[]> {
    try {
      return await FormField.findAll({
        where: all ? undefined as any : { isKpiField: true },
        order: [['name', 'ASC']]
      });
    } catch (error: any) {
      logger.error(`Error getting KPI fields: ${error.message}`);
      throw new Error(`Error getting KPI fields: ${error.message}`);
    }
  }
}

// Define interfaces for the service
export interface KpiFilterOptions {
  fromDate?: Date;
  toDate?: Date;
  entityId?: string;
  entityType?: string;
  projectId?: string;
  subprojectId?: string;
  activityId?: string;
  dataFilters?: DataFilterCondition[];
  beneficiaryId?: string;
  beneficiaryIds?: string[];
  serviceId?: string;
  serviceIds?: string[];
  formTemplateId?: string;
  formTemplateIds?: string[];
}

export interface KpiResult {
  kpiId: string;
  name: string;
  description?: string;
  result: number;
  fieldName: string;
  calculationType: string;
  aggregationType: string;
  timestamp: Date;
}

export interface DataFilterCondition {
  field: string;
  op: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte' | 'exists' | 'not_exists';
  value?: string | number | boolean | Array<string | number | boolean>;
  type?: 'string' | 'number' | 'boolean' | 'date';
}

export interface KpiSeriesResult {
  kpiId: string;
  name: string;
  fieldName: string;
  calculationType: string;
  granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  series: Array<{ periodStart: Date; value: number }>;
}

export default new KpiCalculationService();
