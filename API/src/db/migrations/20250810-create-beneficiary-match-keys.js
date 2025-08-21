'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('beneficiary_match_keys', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      beneficiaryId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: { tableName: 'beneficiaries' },
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      keyType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      keyHash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
    });

    await queryInterface.addIndex('beneficiary_match_keys', ['beneficiaryId']);
    await queryInterface.addIndex('beneficiary_match_keys', ['keyType', 'keyHash'], { unique: true, name: 'beneficiary_match_keys_type_hash_unique' });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('beneficiary_match_keys');
  }
};
