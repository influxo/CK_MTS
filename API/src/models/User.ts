import { Model, DataTypes, Association } from 'sequelize';
import sequelize from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

class User extends Model {
  // Define association methods for TypeScript
  public addRole!: (role: any, options?: any) => Promise<any>;
  public getRoles!: (options?: any) => Promise<any[]>;
  public hasRole!: (role: any, options?: any) => Promise<boolean>;
  public countRoles!: (options?: any) => Promise<number>;
  public removeRole!: (role: any, options?: any) => Promise<any>;
  public setRoles!: (roles: any[], options?: any) => Promise<any>;
  
  // Define associations
  public static associations: {
    roles: Association<User, any>;
  };
  public id!: string;
  public firstName!: string;
  public lastName!: string;
  public email!: string;
  public password!: string;
  public status!: string; // 'active', 'inactive', 'invited', 'suspended'
  public emailVerified!: boolean;
  public verificationToken!: string | null;
  public tokenExpiry!: Date | null;
  public invitedBy!: string | null;
  public twoFactorSecret!: string | null;
  public twoFactorEnabled!: boolean;
  public lastLogin!: Date | null;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Method to check password
  public async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      set(value: string) {
        // Hash password before saving
        const hashedPassword = bcrypt.hashSync(value, 10);
        this.setDataValue('password', hashedPassword);
      }
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'inactive', 'invited', 'suspended']]
      }
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    verificationToken: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: () => crypto.randomBytes(32).toString('hex')
    },
    tokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: () => {
        const date = new Date();
        date.setDate(date.getDate() + 7); // Token valid for 7 days
        return date;
      }
    },
    invitedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    twoFactorSecret: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'users',
    defaultScope: {
      attributes: { exclude: ['password', 'twoFactorSecret'] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password'] },
      },
    },
  }
);

// Add TypeScript interface for User with roles
export interface UserWithRoles extends User {
  roles?: any[];
}

export default User;
