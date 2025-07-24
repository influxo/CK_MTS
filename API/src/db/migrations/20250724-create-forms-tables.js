'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create form_templates table
    await queryInterface.createTable('form_templates', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      programId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: {
            tableName: 'projects'
          },
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      schema: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Create form_responses table
    await queryInterface.createTable('form_responses', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      form_template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: {
            tableName: 'form_templates'
          },
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      programId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: {
            tableName: 'projects'
          },
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      submitted_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: {
            tableName: 'users'
          },
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      latitude: {
        type: Sequelize.DECIMAL(9, 6),
        allowNull: true
      },
      longitude: {
        type: Sequelize.DECIMAL(9, 6),
        allowNull: true
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create composite unique index on form_templates
    await queryInterface.addIndex('form_templates', ['programId', 'name', 'version'], {
      unique: true,
      name: 'form_templates_program_name_version_unique'
    });

    // Create GIN indexes for JSONB fields
    await queryInterface.sequelize.query(
      'CREATE INDEX form_templates_schema_gin ON form_templates USING GIN (schema);'
    );
    
    await queryInterface.sequelize.query(
      'CREATE INDEX form_responses_data_gin ON form_responses USING GIN (data);'
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the tables in reverse order
    await queryInterface.dropTable('form_responses');
    await queryInterface.dropTable('form_templates');
  }
};
