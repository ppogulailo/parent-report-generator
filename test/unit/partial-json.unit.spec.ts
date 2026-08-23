import { expect, test } from '@playwright/test';
import { parsePartialJson } from '../../src/generation/partial-json';

/**
 * The partial parser is what lets a parent watch their plan being written. It is
 * pure, and it is the piece most likely to be subtly wrong, so it is tested
 * directly rather than only through a stream.
 *
 * Its contract is narrow: return whatever is definitely complete, never guess.
 */

test('a complete object parses as itself', () => {
  expect(parsePartialJson('{"a":"one","b":"two"}')).toEqual({
    a: 'one',
    b: 'two',
  });
});

test('a truncated value is dropped, and the finished ones kept', () => {
  expect(parsePartialJson('{"a":"one","b":"tw')).toEqual({ a: 'one' });
});

test('a key with no value yet is dropped', () => {
  expect(parsePartialJson('{"a":"one","b":')).toEqual({ a: 'one' });
  expect(parsePartialJson('{"a":"one","b"')).toEqual({ a: 'one' });
});

test('finished array items are kept and the unfinished one is not', () => {
  expect(parsePartialJson('{"list":["one","two","thr')).toEqual({
    list: ['one', 'two'],
  });
});

test('an object in an array keeps whatever fields have arrived', () => {
  // Deliberately not "whole objects only". A recommendation's headline arrives
  // before its body, and showing the headline the moment it exists is the point
  // of streaming — so a half-filled object is returned rather than withheld.
  // Consumers must tolerate missing fields; the client's merge skips an item
  // with no headline yet.
  const partial = '{"items":[{"id":"a","body":"first"},{"id":"b","body":"seco';
  expect(parsePartialJson(partial)).toEqual({
    items: [{ id: 'a', body: 'first' }, { id: 'b' }],
  });
});

test('escapes and quotes inside a string do not end it early', () => {
  expect(
    parsePartialJson('{"a":"she said \\"no\\" and left","b":"x'),
  ).toEqual({ a: 'she said "no" and left' });
});

test('a brace inside a string is not treated as structure', () => {
  expect(parsePartialJson('{"a":"a { and a } inside","b":"y')).toEqual({
    a: 'a { and a } inside',
  });
});

test('nothing usable yet returns nothing rather than guessing', () => {
  expect(parsePartialJson('')).toEqual({});
  expect(parsePartialJson('{')).toEqual({});
  expect(parsePartialJson('{"a"')).toEqual({});
  expect(parsePartialJson('not json at all')).toEqual({});
});

test('newlines inside prose survive, because sections are paragraphs', () => {
  const text = '{"a":"line one\\n\\nline two","b":"z';
  expect(parsePartialJson(text)).toEqual({ a: 'line one\n\nline two' });
});
