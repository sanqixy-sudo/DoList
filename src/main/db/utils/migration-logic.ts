export function prepareMigrationSql(
  name: string,
  sql: string,
  options: { projectGroupColumnExists: boolean }
): string {
  if (name === '002_project_groups' && options.projectGroupColumnExists) {
    return sql.replace(
      /ALTER TABLE lists ADD COLUMN project_group_id TEXT REFERENCES project_groups\(id\) ON DELETE SET NULL;\s*/i,
      ''
    );
  }

  return sql;
}
