export function imageMarkdown(image) {
  return `![${image.name.replace(/[\\\[\]]/g, '\\$&')}](${image.url})`;
}
